import { NextRequest } from 'next/server'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { json, safe, assertSameOrigin } from '@/lib/visitor/api'
import { requireVisitor, heartbeat } from '@/lib/visitor/auth'
import { limited } from '@/lib/visitor/ratelimit'
import { HttpError } from '@/lib/visitor/api'

export function POST(req: NextRequest) {
  return safe(async () => {
    assertSameOrigin(req)
    const a = await requireVisitor(req)
    if (await limited('hb', a.sessionId, 12, 60)) throw new HttpError(429, 'Slow down.')
    await heartbeat(a)
    return json({ ok: true, expiresAt: a.expiresAt })
  })
}
