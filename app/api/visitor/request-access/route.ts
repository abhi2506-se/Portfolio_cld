import { NextRequest } from 'next/server'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { json, safe, readJson, reqMeta, assertSameOrigin } from '@/lib/visitor/api'
import { accessRequestSchema, firstError } from '@/lib/visitor/validation'
import { submitAccessRequest } from '@/lib/visitor/service'
import { HttpError } from '@/lib/visitor/api'

export function POST(req: NextRequest) {
  return safe(async () => {
    assertSameOrigin(req)
    const body = await readJson(req)
    if (typeof body?.website_hp === 'string' && body.website_hp) return json({ ok: true }) // honeypot: silently drop bots
    const parsed = accessRequestSchema.safeParse(body)
    if (!parsed.success) throw new HttpError(400, firstError(parsed.error))
    await submitAccessRequest(parsed.data, reqMeta(req))
    return json({ ok: true, message: 'Request submitted. You will get an email once it is reviewed.' })
  })
}
