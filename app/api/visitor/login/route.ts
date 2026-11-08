import { NextRequest } from 'next/server'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { json, safe, readJson, reqMeta, assertSameOrigin, setSessionCookie } from '@/lib/visitor/api'
import { login } from '@/lib/visitor/service'

export function POST(req: NextRequest) {
  return safe(async () => {
    assertSameOrigin(req)
    const { email, password } = await readJson(req)
    const s = await login(String(email || ''), String(password || ''), reqMeta(req))
    const res = json({ ok: true })
    setSessionCookie(res, s.token, s.maxAgeSec)
    return res
  })
}
