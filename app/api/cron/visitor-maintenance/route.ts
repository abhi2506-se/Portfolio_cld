import { NextRequest } from 'next/server'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { json, safe, HttpError } from '@/lib/visitor/api'
import { runMaintenance } from '@/lib/visitor/maintenance'
import { safeEqual } from '@/lib/visitor/crypto'

/** Vercel Cron sends "Authorization: Bearer $CRON_SECRET". Unlike older cron routes here, a missing secret = locked, not open. */
export function GET(req: NextRequest) {
  return safe(async () => {
    const secret = process.env.CRON_SECRET
    const got = (req.headers.get('authorization') || '').replace(/^Bearer /, '') || req.headers.get('x-cron-secret') || ''
    if (!secret || !safeEqual(got, secret)) throw new HttpError(401, 'Unauthorized')
    return json({ ok: true, ...(await runMaintenance()) })
  })
}
