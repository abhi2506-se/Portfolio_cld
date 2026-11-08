import { NextRequest } from 'next/server'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { json, safe, adminOnly, readJson, reqMeta, assertSameOrigin, HttpError } from '@/lib/visitor/api'
import { approveRequest, rejectRequest } from '@/lib/visitor/service'

export function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return safe(async () => {
    adminOnly(req); assertSameOrigin(req)
    const { id } = await params
    const b = await readJson(req)
    const m = reqMeta(req)
    if (b.action === 'approve') return json(await approveRequest(id, 'admin', b.validityDays, m))
    if (b.action === 'reject') { await rejectRequest(id, 'admin', b.reason, m); return json({ ok: true }) }
    throw new HttpError(400, 'Unknown action')
  })
}
