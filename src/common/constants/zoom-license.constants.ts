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
