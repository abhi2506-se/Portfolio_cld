import { NextRequest } from 'next/server'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { json, safe } from '@/lib/visitor/api'
import { requireVisitor } from '@/lib/visitor/auth'
import { getFeatureAccess } from '@/lib/visitor/permissions'

/** Own profile only — everything comes from the authenticated session, nothing from the URL. */
export function GET(req: NextRequest) {
  return safe(async () => {
    const a = await requireVisitor(req)
    const { visitorId: _omit, sessionId: _s, ...profile } = a
    return json({ visitor: { ...profile, features: await getFeatureAccess(a.visitorId) } })
  })
}
