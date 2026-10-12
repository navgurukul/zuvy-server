/**
 * Which proxies Express may trust for the client IP (X-Forwarded-For).
 *
 * The API runs in Docker behind nginx on the same EC2 host, so requests
 * arrive from loopback or a Docker bridge address (172.16.0.0/12). Trusting
 * only those private ranges means req.ip is the address nginx saw, and any
 * X-Forwarded-For value a client sends itself is ignored. Never use `true`:
 * Express would then take the left-most, client-controlled address.
 *
 * Override with TRUST_PROXY (comma-separated Express values) if the network
 * layout changes, e.g. "loopback,10.0.0.0/8".
 */
export const TRUST_PROXY: string[] = (
  process.env.TRUST_PROXY || 'loopback,uniquelocal'
)
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
