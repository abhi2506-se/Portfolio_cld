import { NextRequest } from 'next/server'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { json, safe } from '@/lib/visitor/api'
import { requireVisitor } from '@/lib/visitor/auth'
import { sql } from '@/lib/visitor/db'

/** The visitor's OWN audit trail. IP addresses and user agents are deliberately NOT returned (admin-only). */
export function GET(req: NextRequest) {
  return safe(async () => {
    const a = await requireVisitor(req)
    const events = await sql`SELECT id, event_type, actor_type, created_at FROM visitor_audit_logs WHERE visitor_id=${a.visitorId} ORDER BY created_at DESC LIMIT 100`
    return json({ events })
  })
}
