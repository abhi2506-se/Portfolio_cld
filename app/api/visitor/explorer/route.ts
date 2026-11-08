import { NextRequest } from 'next/server'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
import { json, safe } from '@/lib/visitor/api'
import { requireVisitor } from '@/lib/visitor/auth'
import { requireFeature } from '@/lib/visitor/permissions'
import { getExplorerData } from '@/lib/visitor/explorer'

/** GET only. No write method exists here. Locked until admin enables the Explorer for this visitor. */
export function GET(req: NextRequest) {
  return safe(async () => {
    const a = await requireVisitor(req)
    await requireFeature(a.visitorId, 'explorer')
    return json(await getExplorerData())
  })
}
