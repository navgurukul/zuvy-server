import { sql } from 'drizzle-orm';

const DEFAULT_ZOOM_LICENSE_COOLDOWN_MINUTES = 2; //60

const parsedCooldownMinutes = Number(
  process.env.ZOOM_LICENSE_COOLDOWN_MINUTES ||
    DEFAULT_ZOOM_LICENSE_COOLDOWN_MINUTES,
);

export const ZOOM_LICENSE_COOLDOWN_MINUTES =
  Number.isFinite(parsedCooldownMinutes) && parsedCooldownMinutes >= 0
    ? parsedCooldownMinutes
    : DEFAULT_ZOOM_LICENSE_COOLDOWN_MINUTES;

export const ZOOM_LICENSE_COOLDOWN_MS =
  ZOOM_LICENSE_COOLDOWN_MINUTES * 60 * 1000;

export function buildZoomLicenseCooldownIntervalSql() {
  return sql`interval '1 minute' * ${ZOOM_LICENSE_COOLDOWN_MINUTES}`;
}

// Advisory-lock keys. Kept here (no imports beyond drizzle) so one-off
// scripts can use them without loading the Nest services.

// Serialises every licence allocation (classes, mentor bookings, mentor slot
// checks), so two allocations can never both see the last free licence.
export const LICENSE_POOL_LOCK_KEY = 'zuvy_zoom_license_pool';

// Serialises Zoom licence transfers (picking a donor account and moving its
// licence), so two transfers at once can't pick the same donor. Separate from
// the pool lock: a transfer makes Zoom calls, and must not hold up
// allocations that don't need one.
export const LICENSE_TRANSFER_LOCK_KEY = 'zuvy_zoom_license_transfer';
