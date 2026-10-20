import { Body, Controller, Headers, Logger, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { OAuth2Client } from 'google-auth-library';
import { Public } from 'src/auth/decorators/public.decorator';
import { GmailMonitorService } from './gmail-monitor.service';

// Pub/Sub push subscriptions authenticate themselves with a Google-issued
// OIDC bearer token (configured when the subscription is created) rather
// than a shared-secret signature. Verifying it requires checking three
// things: the token's signature (against Google's public certs), the
// audience claim (must match this exact endpoint's URL), and the email
// claim (must match the specific service account the subscription was
// configured to use) — checking only the first would let any Google-issued
// token from an unrelated source authenticate here.
const EXPECTED_AUDIENCE = process.env.GMAIL_PUBSUB_AUDIENCE;
const EXPECTED_SERVICE_ACCOUNT = process.env.GMAIL_PUBSUB_SERVICE_ACCOUNT_EMAIL;

const oidcClient = new OAuth2Client();

@Controller('webhooks/gmail')
export class GmailMonitorController {
  private readonly logger = new Logger(GmailMonitorController.name);

  constructor(private readonly gmailMonitorService: GmailMonitorService) {}

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60 } })
  @Post('notifications')
  async handleNotification(
    @Headers('authorization') authHeader: string,
    @Body() body: any,
  ) {
    // Fail closed: if the expected audience/service account aren't
    // configured, there is nothing meaningful to verify a token against —
    // reject rather than silently accept unauthenticated pushes.
    if (!EXPECTED_AUDIENCE || !EXPECTED_SERVICE_ACCOUNT) {
      this.logger.error(
        'GMAIL_PUBSUB_AUDIENCE or GMAIL_PUBSUB_SERVICE_ACCOUNT_EMAIL is not configured — rejecting all pushes',
      );
      return { status: 'rejected' };
    }

    const token = authHeader?.replace(/^Bearer\s+/i, '');
    if (!token) {
      this.logger.warn('Gmail push notification missing Authorization header');
      return { status: 'rejected' };
    }

    try {
      const ticket = await oidcClient.verifyIdToken({
        idToken: token,
        audience: EXPECTED_AUDIENCE,
      });
      const payload = ticket.getPayload();
      if (
        !payload?.email_verified ||
        payload.email !== EXPECTED_SERVICE_ACCOUNT
      ) {
        this.logger.warn(
          `Gmail push notification token verified but email claim mismatch (got ${payload?.email})`,
        );
        return { status: 'rejected' };
      }
    } catch (err: any) {
      this.logger.warn(
        `Gmail push notification token verification failed: ${err?.message ?? err}`,
      );
      return { status: 'rejected' };
    }

    // The push payload itself carries no content, just enough to know
    // something changed — see gmail-monitor.service.ts for why the actual
    // processing is a separate history.list() call.
    try {
      const decoded = JSON.parse(
        Buffer.from(body?.message?.data || '', 'base64').toString('utf8'),
      );
      await this.gmailMonitorService.handlePushNotification(
        decoded.emailAddress,
        String(decoded.historyId),
      );
    } catch (err: any) {
      // Acknowledge anyway (200) rather than let Pub/Sub retry-storm on a
      // processing bug — the fallback poll is the safety net for a message
      // this failed to fully process, not Pub/Sub's own redelivery.
      this.logger.error(
        `Failed to process Gmail push notification: ${err?.message ?? err}`,
      );
    }

    return { status: 'ok' };
  }
}
