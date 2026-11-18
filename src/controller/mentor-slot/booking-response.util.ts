// zoomStartUrl logs whoever opens it into the meeting as the host, and
// zoomPassword is only needed by the host. Students join through meetingLink,
// so neither field may appear in a response sent to a student.
export function withoutHostZoomFields<T extends Record<string, any>>(
  booking: T,
): Omit<T, 'zoomStartUrl' | 'zoomPassword'> {
  const safe = { ...booking };
  delete safe.zoomStartUrl;
  delete safe.zoomPassword;
  return safe;
}
