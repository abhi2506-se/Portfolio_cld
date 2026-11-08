import { NextRequest } from 'next/server'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
import { json, safe, adminOnly, reqMeta, assertSameOrigin, HttpError } from '@/lib/visitor/api'
import { listAllDemoChats, adminDemoMessages } from '@/lib/visitor/admin-queries'
import { adminDeleteChat } from '@/lib/visitor/demo'

export function GET(req: NextRequest) {
  return safe(async () => {
    adminOnly(req)
    const chatId = req.nextUrl.searchParams.get('chatId')
    return json(chatId ? { messages: await adminDemoMessages(chatId) } : { chats: await listAllDemoChats() })
  })
}

/** PERMANENTLY deletes a demo chat and all its messages. */
export function DELETE(req: NextRequest) {
  return safe(async () => {
    adminOnly(req); assertSameOrigin(req)
    const chatId = req.nextUrl.searchParams.get('chatId') || ''
    if (!chatId || chatId.length > 100) throw new HttpError(400, 'chatId is required.')
    await adminDeleteChat(chatId, 'admin', reqMeta(req))
    return json({ ok: true })
  })
}
