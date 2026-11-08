import { NextRequest } from 'next/server'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { json, safe, readJson, reqMeta, assertSameOrigin, HttpError } from '@/lib/visitor/api'
import { limited } from '@/lib/visitor/ratelimit'
import { generateDemoReply } from '@/lib/visitor/demo-ai'
import { preChatSchema, firstError } from '@/lib/visitor/validation'

/**
 * Public-site "Demo Chat" (pre-chat option 1). STATELESS: nothing is written to the database and
 * nothing touches live_chats / live_chat_messages — the browser keeps the history and sends it back.
 */
export function POST(req: NextRequest) {
  return safe(async () => {
    assertSameOrigin(req)
    const m = reqMeta(req)
    if (await limited('pub-demo', m.ip || 'unknown', 20, 600)) throw new HttpError(429, 'Too many demo messages. Please wait a few minutes.')
    const body = await readJson(req)
    const who = preChatSchema.safeParse({ name: body?.name, email: body?.email, mobile: body?.mobile })
    if (!who.success) throw new HttpError(400, firstError(who.error))
    const hist = Array.isArray(body?.history) ? body.history.slice(-14) : []
    const messages = hist
      .filter((h: any) => h && (h.role === 'user' || h.role === 'assistant') && typeof h.content === 'string')
      .map((h: any) => ({ role: h.role, content: String(h.content).slice(0, 1000) }))
    const last = messages[messages.length - 1]
    if (!last || last.role !== 'user') throw new HttpError(400, 'Send a message first.')
    const reply = await generateDemoReply(messages, who.data.name)
    return json({ reply: reply ?? 'The demo assistant is unavailable right now. Please try again shortly.' })
  })
}
