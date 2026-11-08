import { NextRequest } from 'next/server'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { json, safe, readJson, reqMeta, assertSameOrigin } from '@/lib/visitor/api'
import { requireVisitor } from '@/lib/visitor/auth'
import { changePassword } from '@/lib/visitor/service'

export function POST(req: NextRequest) {
  return safe(async () => {
    assertSameOrigin(req)
    const a = await requireVisitor(req)
    const { currentPassword, newPassword } = await readJson(req)
    await changePassword(a.visitorId, a.sessionId, String(currentPassword || ''), String(newPassword || ''), reqMeta(req))
    return json({ ok: true })
  })
}
