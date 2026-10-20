import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { google } from 'googleapis';
import { sql } from 'drizzle-orm';
import { db } from '../../db/index';

const GMAIL_MONITOR_ENABLED = process.env.GMAIL_MONITOR_ENABLED === 'true';
const WATCHED_EMAIL = process.env.GMAIL_MONITOR_EMAIL_ADDRESS;
const PUBSUB_TOPIC = process.env.GMAIL_PUBSUB_TOPIC; // e.g. projects/{project}/topics/{topic}

// No official spec exists for what a YouTube violation notification email's
// sender/subject actually looks like (confirmed during research — see
// youtube-recording-durability-and-restore-strategy.md §11). This is a
// deliberately loose, reverse-engineered heuristic — it only decides what
// gets labeled "candidate" for a human to look at faster; every email this
// pipeline sees still gets logged regardless of whether it matches, so a
// wrong or incomplete heuristic never causes a silent loss, only a slower
// human review.
const CANDIDATE_SENDER_PATTERNS = [/youtube/i, /@google\.com$/i];
const CANDIDATE_SUBJECT_PATTERNS = [
  /copyright/i,
  /claim/i,
  /strike/i,
  /community guideline/i,
  /content id/i,
  /removed/i,
  /takedown/i,
];

@Injectable()
export class GmailMonitorService implements OnModuleInit {
  private readonly logger = new Logger(GmailMonitorService.name);
  private readonly gmail: any;

  constructor() {
    const oAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'https://developers.google.com/oauthplayground',
    );
    oAuth2Client.setCredentials({
      refresh_token: process.env.GMAIL_MONITOR_REFRESH_TOKEN,
    });
    this.gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
  }

  onModuleInit() {
    this.logger.log(
      `Gmail monitor config: GMAIL_MONITOR_ENABLED=${GMAIL_MONITOR_ENABLED} GMAIL_MONITOR_EMAIL_ADDRESS=${WATCHED_EMAIL || '(unset)'} GMAIL_PUBSUB_TOPIC=${PUBSUB_TOPIC || '(unset)'}`,
    );

    // Also try once at startup, not just on the daily @Cron schedule — a
    // fresh restart (e.g. right after this feature is first enabled)
    // otherwise waits up to 24h for the first watch to ever be established.
    // Fire-and-forget: errors are logged inside renewWatchIfNeeded() itself
    // and must never block app startup.
    this.renewWatchIfNeeded().catch((err) =>
      this.logger.error('Initial Gmail watch check failed', err),
    );
  }

  // =====================================================
  // WATCH LIFECYCLE
  // =====================================================

  // Google's watch() expires in exactly 7 days with no grace period and no
  // error when it lapses — notifications just silently stop. Renewing daily
  // (not waiting for the deadline) is Google's own recommendation; this is
  // also safe to call on-demand (e.g. right after GMAIL_MONITOR_ENABLED is
  // first turned on) since it no-ops if the current watch still has >24h left.
  @Cron('0 3 * * *', { timeZone: 'Asia/Kolkata' })
  async renewWatchIfNeeded(): Promise<void> {
    if (!GMAIL_MONITOR_ENABLED) return;
    if (!WATCHED_EMAIL || !PUBSUB_TOPIC) {
      this.logger.warn(
        'GMAIL_MONITOR_ENABLED=true but GMAIL_MONITOR_EMAIL_ADDRESS or GMAIL_PUBSUB_TOPIC is unset — skipping watch renewal',
      );
      return;
    }

    try {
      const existing = await db.execute(sql`
        SELECT watch_expiration FROM zuvy_gmail_watch_state WHERE email_address = ${WATCHED_EMAIL}
      `);
      const expiration = existing.rows?.[0]?.watch_expiration
        ? new Date(existing.rows[0].watch_expiration as any)
        : null;
      const hoursUntilExpiry = expiration
        ? (expiration.getTime() - Date.now()) / (1000 * 60 * 60)
        : -1; // no existing watch — treat as already expired

      if (hoursUntilExpiry > 24) {
        this.logger.log(
          `Gmail watch for ${WATCHED_EMAIL} still has ${hoursUntilExpiry.toFixed(1)}h left, skipping renewal`,
        );
        return;
      }

      const res = await this.gmail.users.watch({
        userId: 'me',
        requestBody: {
          topicName: PUBSUB_TOPIC,
          labelFilterAction: 'include',
          labelIds: ['INBOX'],
        },
      });

      const newHistoryId = String(res.data.historyId);
      const newExpiration = new Date(Number(res.data.expiration)); // ms-epoch per Gmail API

      await db.execute(sql`
        INSERT INTO zuvy_gmail_watch_state (email_address, history_id, watch_expiration, last_renewed_at, updated_at)
        VALUES (${WATCHED_EMAIL}, ${newHistoryId}, ${newExpiration.toISOString()}, NOW(), NOW())
        ON CONFLICT (email_address) DO UPDATE SET
          history_id = EXCLUDED.history_id,
          watch_expiration = EXCLUDED.watch_expiration,
          last_renewed_at = NOW(),
          updated_at = NOW()
      `);

      this.logger.log(
        `Gmail watch renewed for ${WATCHED_EMAIL}, expires ${newExpiration.toISOString()}`,
      );
    } catch (err: any) {
      this.logger.error(
        `Failed to renew Gmail watch for ${WATCHED_EMAIL}: ${err?.message ?? err}`,
      );
    }
  }

  // =====================================================
  // PUSH NOTIFICATION HANDLER (called by the webhook controller)
  // =====================================================
  async handlePushNotification(
    emailAddress: string,
    pushHistoryId: string,
  ): Promise<void> {
    if (!GMAIL_MONITOR_ENABLED) return;

    try {
      await this.processNewHistory(emailAddress);
    } finally {
      // Store the push's own historyId as the new high-water mark regardless
      // of whether processing above succeeded — processHistorySince() always
      // starts from the last successfully-stored id, so a transient failure
      // here is caught by the next push or the fallback poll re-processing
      // the same range, not lost.
      await db.execute(sql`
        UPDATE zuvy_gmail_watch_state SET history_id = ${pushHistoryId}, updated_at = NOW()
        WHERE email_address = ${emailAddress}
      `);
    }
  }

  // =====================================================
  // FALLBACK POLL — independent safety net
  //
  // Google's own docs concede push notifications "might be delayed or
  // dropped" (capped ~1/second per mailbox, excess coalesced). This re-runs
  // the identical history-processing logic on a fixed schedule regardless of
  // whether any push ever arrived, so a dropped notification doesn't mean a
  // permanently missed email.
  // =====================================================
  @Cron('*/30 * * * *')
  async fallbackPoll(): Promise<void> {
    if (!GMAIL_MONITOR_ENABLED || !WATCHED_EMAIL) return;
    try {
      await this.processNewHistory(WATCHED_EMAIL);
    } catch (err: any) {
      this.logger.error(`Gmail fallback poll failed: ${err?.message ?? err}`);
    }
  }

  // =====================================================
  // SHARED HISTORY PROCESSING
  // =====================================================
  private async processNewHistory(emailAddress: string): Promise<void> {
    const state = await db.execute(sql`
      SELECT history_id FROM zuvy_gmail_watch_state WHERE email_address = ${emailAddress}
    `);
    const startHistoryId = state.rows?.[0]?.history_id as string | undefined;
    if (!startHistoryId) {
      this.logger.warn(
        `No stored historyId for ${emailAddress} yet — waiting for the next watch renewal to establish a baseline`,
      );
      return;
    }

    let pageToken: string | undefined;
    let latestHistoryId = startHistoryId;

    do {
      let page: any;
      try {
        page = await this.gmail.users.history.list({
          userId: 'me',
          startHistoryId,
          historyTypes: ['messageAdded'],
          pageToken,
        });
      } catch (err: any) {
        // A 404 here means startHistoryId is too old (Gmail only retains a
        // limited history window) — the only recovery is re-baselining from
        // the current state, which means any mail in the gap is unrecoverable
        // by this mechanism. Logged loudly since it's a real (if rare) gap.
        if (err?.code === 404 || err?.response?.status === 404) {
          this.logger.error(
            `Gmail history for ${emailAddress} expired (startHistoryId too old) — re-baselining from current state; any mail in the gap was missed by this pipeline`,
          );
          const profile = await this.gmail.users.getProfile({ userId: 'me' });
          await db.execute(sql`
            UPDATE zuvy_gmail_watch_state SET history_id = ${String(profile.data.historyId)}, updated_at = NOW()
            WHERE email_address = ${emailAddress}
          `);
          return;
        }
        throw err;
      }

      const histories = page.data.history || [];
      for (const h of histories) {
        for (const added of h.messagesAdded || []) {
          try {
            await this.logCandidateMessage(added.message.id);
          } catch (err: any) {
            // Confirmed live (2026-10-19): an ordinary Gmail draft autosave
            // produces a messageAdded history entry whose message ID is
            // superseded (and 404s on messages.get) within moments, well
            // before this batch is even processed — not a rare edge case.
            // Previously this threw uncaught, aborting the whole batch
            // (including every message after the failed one) and — worse —
            // meant history_id below never advanced, so every subsequent
            // poll retried the exact same stale entry forever, permanently
            // blocking all future mail from ever being processed. One
            // message's fetch failing must never block the rest of the
            // batch or the watermark from advancing.
            this.logger.warn(
              `Failed to fetch Gmail message ${added.message.id}, skipping it (batch continues): ${err?.message ?? err}`,
            );
          }
        }
      }
      if (page.data.historyId) latestHistoryId = String(page.data.historyId);
      pageToken = page.data.nextPageToken || undefined;
    } while (pageToken);

    await db.execute(sql`
      UPDATE zuvy_gmail_watch_state SET history_id = ${latestHistoryId}, updated_at = NOW()
      WHERE email_address = ${emailAddress}
    `);
  }

  private async logCandidateMessage(messageId: string): Promise<void> {
    const existing = await db.execute(sql`
      SELECT id FROM zuvy_youtube_violation_emails WHERE gmail_message_id = ${messageId}
    `);
    if (existing.rows?.length) return; // already logged, idempotent

    const msg = await this.gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'metadata',
      metadataHeaders: ['From', 'Subject', 'Date'],
    });

    const headers: Record<string, string> = {};
    for (const h of msg.data.payload?.headers || []) {
      headers[h.name] = h.value;
    }

    const from = headers['From'] || '';
    const subject = headers['Subject'] || '';
    const receivedAt = headers['Date'] ? new Date(headers['Date']) : null;
    const classification = this.classifyCandidate(from, subject);

    await db.execute(sql`
      INSERT INTO zuvy_youtube_violation_emails
        (gmail_message_id, from_address, subject, received_at, classification, raw_headers)
      VALUES (${messageId}, ${from}, ${subject}, ${receivedAt?.toISOString() ?? null}, ${classification}, ${JSON.stringify(headers)})
      ON CONFLICT (gmail_message_id) DO NOTHING
    `);

    if (classification) {
      this.logger.warn(
        `[GMAIL_MONITOR] Candidate YouTube violation email detected: from="${from}" subject="${subject}" classification=${classification} — needs human review`,
      );
    }
  }

  // Deliberately permissive: flags anything that merely LOOKS related, never
  // tries to definitively confirm it. False positives cost a human a few
  // seconds reviewing a normal email; false negatives mean a real violation
  // email goes unnoticed, which is the exact failure mode this whole
  // pipeline exists to close. Every message is logged either way (see
  // logCandidateMessage), so this only affects how loudly it's flagged.
  private classifyCandidate(from: string, subject: string): string | null {
    const senderMatches = CANDIDATE_SENDER_PATTERNS.some((p) => p.test(from));
    if (!senderMatches) return null;

    for (const pattern of CANDIDATE_SUBJECT_PATTERNS) {
      if (pattern.test(subject)) {
        return pattern.source.replace(/[^a-z0-9]+/gi, '_').toLowerCase();
      }
    }
    return senderMatches ? 'unclassified_youtube_sender' : null;
  }
}
