import { NextRequest } from 'next/server'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
import { json, safe, reqMeta, assertSameOrigin } from '@/lib/visitor/api'
import { requireVisitor } from '@/lib/visitor/auth'
import { requireFeature } from '@/lib/visitor/permissions'
import { listChats, createChat } from '@/lib/visitor/demo'

export function GET(req: NextRequest) {
  return safe(async () => {
    const a = await requireVisitor(req); await requireFeature(a.visitorId, 'demo_chat')
    return json({ chats: await listChats(a.visitorId) })
  })
}
export function POST(req: NextRequest) {
  return safe(async () => {
    assertSameOrigin(req)
    const a = await requireVisitor(req); await requireFeature(a.visitorId, 'demo_chat')
    return json(await createChat(a.visitorId, reqMeta(req)))
  })
}
