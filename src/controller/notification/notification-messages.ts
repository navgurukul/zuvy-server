/**
 * The reschedule request line in the notification list. Requests store the
 * new time and the mentor's reply-by deadline ("A student asked to move
 * their session to … Reply by …"): keep that and only put the student's
 * name in. Requests made before that were stored with an empty message, so
 * they keep the generic line.
 *
 * Kept apart from NotificationService (no database import) so it can be
 * unit-tested on its own.
 */
export function rescheduleRequestListMessage(
  stored: string,
  studentName: string | null | undefined,
): string {
  const prefix = 'A student ';
  if (stored) {
    return studentName && stored.startsWith(prefix)
      ? `${studentName} ${stored.slice(prefix.length)}`
      : stored;
  }
  return studentName
    ? `${studentName} requested to reschedule this mentorship session.`
    : stored;
}
