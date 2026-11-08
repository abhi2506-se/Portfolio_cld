import { NextRequest } from 'next/server'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
import { json, safe, readJson, assertSameOrigin } from '@/lib/visitor/api'
import { requireVisitor } from '@/lib/visitor/auth'
import { requireFeature } from '@/lib/visitor/permissions'
import { getMessages, sendMessage } from '@/lib/visitor/demo'

type Ctx = { params: Promise<{ id: string }> }
export function GET(req: NextRequest, { params }: Ctx) {
  return safe(async () => {
    const a = await requireVisitor(req); await requireFeature(a.visitorId, 'demo_chat')
    const { id } = await params
    return json({ messages: await getMessages(a.visitorId, id) })
  })
}
export function POST(req: NextRequest, { params }: Ctx) {
  return safe(async () => {
    assertSameOrigin(req)
    const a = await requireVisitor(req); await requireFeature(a.visitorId, 'demo_chat')
    const { id } = await params
    const { content } = await readJson(req)
    return json({ message: await sendMessage(a.visitorId, a.fullName, id, content) })
  })
}
