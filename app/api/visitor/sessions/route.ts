import { NextRequest } from 'next/server'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { json, safe, reqMeta, assertSameOrigin } from '@/lib/visitor/api'
import { requireVisitor, revokeSessions } from '@/lib/visitor/auth'
import { sql } from '@/lib/visitor/db'
import { logAudit } from '@/lib/visitor/audit'

export function GET(req: NextRequest) {
  return safe(async () => {
    const a = await requireVisitor(req)
    const sessions = await sql`SELECT id, login_at, last_active_at, logout_at, revoked_at, device_category, browser, os, online_seconds
      FROM visitor_sessions_auth WHERE visitor_id=${a.visitorId} ORDER BY login_at DESC LIMIT 20`
    return json({ sessions: sessions.map(s => ({ ...s, current: s.id === a.sessionId })) })
  })
}

/** "Sign out other devices" */
export function POST(req: NextRequest) {
  return safe(async () => {
    assertSameOrigin(req)
    const a = await requireVisitor(req)
    const n = await revokeSessions(a.visitorId, 'visitor_revoked_others', a.sessionId)
    const m = reqMeta(req)
    await logAudit({ event: 'session_revoked', actor: 'visitor', actorId: a.visitorId, visitorId: a.visitorId, ip: m.ip, ua: m.ua, meta: { count: n } })
    return json({ ok: true, revoked: n })
  })
}
