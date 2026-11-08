import { NextRequest } from 'next/server'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { json, safe, adminOnly, readJson, reqMeta, assertSameOrigin, HttpError } from '@/lib/visitor/api'
import { getVisitorDetail } from '@/lib/visitor/admin-queries'
import { adminSetEnabled, adminResetPassword, adminExtend, adminRevokeSessions, adminResendActivation } from '@/lib/visitor/service'
import { adminSetFeature, type Feature } from '@/lib/visitor/permissions'

type Ctx = { params: Promise<{ id: string }> }
export function GET(req: NextRequest, { params }: Ctx) {
  return safe(async () => { adminOnly(req); return json(await getVisitorDetail((await params).id)) })
}
export function POST(req: NextRequest, { params }: Ctx) {
  return safe(async () => {
    adminOnly(req); assertSameOrigin(req)
    const { id } = await params
    const b = await readJson(req); const m = reqMeta(req)
    switch (b.action) {
      case 'disable': { const r = await adminSetEnabled(id, false, 'admin', b.reason, m); return json({ ok: true, emailSent: r.ok, emailError: r.error }) }
      case 'enable': { const r = await adminSetEnabled(id, true, 'admin', null, m); return json({ ok: true, emailSent: r.ok, emailError: r.error }) }
      case 'reset_password': { const r = await adminResetPassword(id, 'admin', m); return json({ ok: true, emailSent: r.ok, emailError: r.error }) }
      case 'resend_activation': { const r = await adminResendActivation(id, 'admin', m); return json({ ok: true, emailSent: r.ok, emailError: r.error }) }
      case 'extend': return json({ ok: true, ...(await adminExtend(id, 'admin', { days: b.days, date: b.date }, m)) })
      case 'revoke_sessions': return json({ ok: true, revoked: await adminRevokeSessions(id, 'admin', m) })
      case 'set_feature': await adminSetFeature(id, b.feature as Feature, !!b.granted, 'admin', m); return json({ ok: true })
      default: throw new HttpError(400, 'Unknown action')
    }
  })
}
