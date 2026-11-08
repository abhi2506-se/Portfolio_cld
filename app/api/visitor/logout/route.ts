import { NextRequest } from 'next/server'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { json, safe, reqMeta, assertSameOrigin, clearSessionCookie } from '@/lib/visitor/api'
import { getAuthedVisitor, endSession } from '@/lib/visitor/auth'
import { logAudit } from '@/lib/visitor/audit'

export function POST(req: NextRequest) {
  return safe(async () => {
    assertSameOrigin(req)
    const a = await getAuthedVisitor(req)
    if (a) {
      await endSession(a.sessionId)
      const m = reqMeta(req)
      await logAudit({ event: 'logout', actor: 'visitor', actorId: a.visitorId, visitorId: a.visitorId, ip: m.ip, ua: m.ua })
    }
    const res = json({ ok: true })
    clearSessionCookie(res)
    return res
  })
}
