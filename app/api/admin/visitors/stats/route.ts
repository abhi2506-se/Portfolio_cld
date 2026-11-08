import { NextRequest } from 'next/server'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { json, safe, adminOnly } from '@/lib/visitor/api'
import { getStats } from '@/lib/visitor/admin-queries'
import { mailConfigured } from '@/lib/visitor/mailer'
export function GET(req: NextRequest) {
  return safe(async () => { adminOnly(req); return json({ stats: await getStats(), smtpConfigured: mailConfigured() }) })
}
