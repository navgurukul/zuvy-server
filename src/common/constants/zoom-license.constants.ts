import { Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';

// How long a licence stays with its host after a session ends, so Zoom can
// finish processing and uploading the cloud recording before the licence
// moves to someone else. Never less than 60 minutes;
// ZOOM_LICENSE_COOLDOWN_MINUTES can only make it longer.
const MIN_ZOOM_LICENSE_COOLDOWN_MINUTES = 60;

const configuredCooldown = (
  process.env.ZOOM_LICENSE_COOLDOWN_MINUTES || ''
).trim();
const parsedCooldownMinutes = Number(configuredCooldown);

export const ZOOM_LICENSE_COOLDOWN_MINUTES =
  configuredCooldown &&
  Number.isFinite(parsedCooldownMinutes) &&
  parsedCooldownMinutes >= MIN_ZOOM_LICENSE_COOLDOWN_MINUTES
    ? parsedCooldownMinutes
    : MIN_ZOOM_LICENSE_COOLDOWN_MINUTES;

if (
  configuredCooldown &&
  ZOOM_LICENSE_COOLDOWN_MINUTES !== parsedCooldownMinutes
) {
  new Logger('ZoomLicense').warn(
    `ZOOM_LICENSE_COOLDOWN_MINUTES="${configuredCooldown}" is not a number of at least ${MIN_ZOOM_LICENSE_COOLDOWN_MINUTES} minutes (Zoom needs the time to process recordings); using ${MIN_ZOOM_LICENSE_COOLDOWN_MINUTES}.`,
  );
}

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
