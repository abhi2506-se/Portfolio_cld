import { isRateLimited, clientIp } from '@/lib/portal/ratelimit'
export { clientIp }
/** Thin wrapper so every visitor bucket is prefixed. Uses Upstash when configured, in-memory otherwise. */
export const limited = (bucket: string, id: string, limit: number, windowSeconds: number) =>
  isRateLimited(`visitor:${bucket}`, id, limit, windowSeconds)
