import { withoutHostZoomFields } from './booking-response.util';

describe('withoutHostZoomFields', () => {
  it('removes the Zoom host link and password and keeps everything else', () => {
    const booking = {
      id: 7,
      meetingLink: 'https://zoom.us/j/123?pwd=abc',
      zoomStartUrl: 'https://zoom.us/s/123?zak=host-token',
      zoomPassword: 'secret',
      zoomMeetingId: '123',
      status: 'confirmed',
    };

    const safe = withoutHostZoomFields(booking);

    expect(safe).toEqual({
      id: 7,
      meetingLink: 'https://zoom.us/j/123?pwd=abc',
      zoomMeetingId: '123',
      status: 'confirmed',
    });
    expect('zoomStartUrl' in safe).toBe(false);
    expect('zoomPassword' in safe).toBe(false);
  });

  it('does not mutate the original booking', () => {
    const booking = { id: 1, zoomStartUrl: 'host', zoomPassword: 'pw' };
    withoutHostZoomFields(booking);
    expect(booking.zoomStartUrl).toBe('host');
  });
});
