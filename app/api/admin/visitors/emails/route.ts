import { NextRequest } from 'next/server'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { json, safe, adminOnly } from '@/lib/visitor/api'
import { listEmailLogs } from '@/lib/visitor/admin-queries'
export function GET(req: NextRequest) { return safe(async () => { adminOnly(req); return json({ emails: await listEmailLogs() }) }) }
