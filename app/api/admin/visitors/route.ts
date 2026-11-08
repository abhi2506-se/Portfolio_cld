import { NextRequest } from 'next/server'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { json, safe, adminOnly, readJson, reqMeta, assertSameOrigin, HttpError } from '@/lib/visitor/api'
import { listVisitors } from '@/lib/visitor/admin-queries'
import { createVisitorManually } from '@/lib/visitor/service'
import { adminCreateVisitorSchema, firstError } from '@/lib/visitor/validation'

export function GET(req: NextRequest) {
  return safe(async () => {
    adminOnly(req)
    const p = req.nextUrl.searchParams
    return json({ visitors: await listVisitors(p.get('filter') || '', (p.get('q') || '').slice(0, 80)) })
  })
}
export function POST(req: NextRequest) {
  return safe(async () => {
    adminOnly(req); assertSameOrigin(req)
    const parsed = adminCreateVisitorSchema.safeParse(await readJson(req))
    if (!parsed.success) throw new HttpError(400, firstError(parsed.error))
    const { validityDays, ...data } = parsed.data
    return json(await createVisitorManually(data, validityDays, 'admin', reqMeta(req)))
  })
}
