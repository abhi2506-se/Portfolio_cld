import { NextRequest } from 'next/server'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { json, safe, adminOnly } from '@/lib/visitor/api'
import { listRequests } from '@/lib/visitor/admin-queries'
export function GET(req: NextRequest) {
  return safe(async () => { adminOnly(req); return json({ requests: await listRequests(req.nextUrl.searchParams.get('status') || '') }) })
}
