export type DownloadAuthDecision =
  | { kind: 'already-authed' }
  | { kind: 'webhook-token'; token: string }
  | { kind: 'oauth-token' };

/**
 * Zoom's cloud-recording download URLs come in two shapes that are NOT
 * interchangeable on authentication:
 *  - `rec/download/...` — returned by the REST API (`GET .../recordings`).
 *    Accepts our Server-to-Server OAuth app token as `?access_token=`.
 *  - `rec/webhook_download/...` — only ever appears in the
 *    `recording.completed` webhook payload. Zoom rejects the OAuth token
 *    here with a 401; it only accepts the `download_token` issued alongside
 *    that same webhook delivery.
 *
 * This was the root cause of recordings permanently failing with
 * "Request failed with status code 401": the worker always used the OAuth
 * token, even against webhook_download URLs.
 */
export function resolveDownloadAuth(
  rawDownloadUrl: string,
  webhookToken?: string | null,
): DownloadAuthDecision {
  if (rawDownloadUrl.includes('access_token=')) {
    return { kind: 'already-authed' };
  }

  if (rawDownloadUrl.includes('/webhook_download/') && webhookToken) {
    return { kind: 'webhook-token', token: webhookToken };
  }

  return { kind: 'oauth-token' };
}
