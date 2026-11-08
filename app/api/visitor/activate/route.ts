import { NextRequest } from 'next/server'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { json, safe, readJson, reqMeta, assertSameOrigin } from '@/lib/visitor/api'
import { inspectToken, completeToken } from '@/lib/visitor/service'

export function GET(req: NextRequest) {
  return safe(async () => json(await inspectToken(req.nextUrl.searchParams.get('token') || '')))
}
export function POST(req: NextRequest) {
  return safe(async () => {
    assertSameOrigin(req)
    const { token, password } = await readJson(req)
    const r = await completeToken(String(token || ''), String(password || ''), reqMeta(req))
    return json({ ok: true, type: r.type })
  })
}
