/**
 * Encodes a Zoom meeting UUID for use as a REST API path segment.
 *
 * Zoom UUIDs are base64 and routinely contain '/', '+', '=' — always in
 * need of percent-encoding. But Zoom's API gateway also decodes the request
 * path ONCE before routing to the handler. A single encodeURIComponent
 * survives that fine for most UUIDs, but for one that starts with '/' or
 * contains '//', that one gateway decode pass turns the encoded '%2F' back
 * into a raw '/', which the router reads as an (empty) extra path segment
 * and 400/404s the lookup instead of matching it as the UUID.
 *
 * This was the root cause of recording download job 311 (and any other
 * meeting instance whose UUID happens to start with '/') falling back to
 * the webhook-only download URL and hitting a 401 there — see
 * getZoomRecordingFilesByUuid in zoom.service.ts.
 *
 * Double-encoding survives the gateway's one decode pass intact (it lands
 * back on the single-encoded form) and is also safe for UUIDs that never
 * needed it, so — matching every other UUID-keyed call in zoom.service.ts
 * (isMeetingLiveViaDashboard, getMeetingParticipants, deleteFromZoomCloud,
 * getAllMeetingRecordings) — this always double-encodes.
 */
export function encodeZoomMeetingUuid(uuid: string): string {
  return encodeURIComponent(encodeURIComponent(uuid));
}
