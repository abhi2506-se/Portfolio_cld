import { sql } from './db'
import { HttpError } from './api'
import { newId } from './crypto'
import { limited } from './ratelimit'
import { logAudit } from './audit'
import { generateDemoReply } from './demo-ai'

const MAX_CHATS_PER_VISITOR = 20
const MAX_MESSAGES_PER_DAY = 100

/** Every query below filters by the SERVER-authenticated visitorId — chat ids from the client are only ever matched together with it. */
export async function listChats(visitorId: string) {
  return sql`SELECT id, title, created_at, updated_at FROM demo_chats WHERE visitor_id=${visitorId} ORDER BY updated_at DESC LIMIT 50`
}

export async function createChat(visitorId: string, m: { ip: string | null; ua: string }) {
  const n = (await sql`SELECT COUNT(*)::int AS n FROM demo_chats WHERE visitor_id=${visitorId}`)[0].n
  if (n >= MAX_CHATS_PER_VISITOR) throw new HttpError(429, 'Demo chat limit reached.')
  const id = newId()
  await sql`INSERT INTO demo_chats (id, visitor_id) VALUES (${id}, ${visitorId})`
  await logAudit({ event: 'demo_chat_created', actor: 'visitor', actorId: visitorId, visitorId, ip: m.ip, ua: m.ua, meta: { chatId: id } })
  return { id }
}

async function ownedChat(visitorId: string, chatId: string) {
  const c = (await sql`SELECT id, title FROM demo_chats WHERE id=${chatId} AND visitor_id=${visitorId}`)[0]
  if (!c) throw new HttpError(404, 'Chat not found.') // identical for "missing" and "someone else's" → no IDOR oracle
  return c
}

export async function getMessages(visitorId: string, chatId: string) {
  await ownedChat(visitorId, chatId)
  return sql`SELECT id, role, content, created_at FROM demo_chat_messages WHERE chat_id=${chatId} AND visitor_id=${visitorId} ORDER BY created_at ASC LIMIT 500`
}

export async function sendMessage(visitorId: string, visitorName: string, chatId: string, content: unknown) {
  const text = typeof content === 'string' ? content.trim() : ''
  if (!text) throw new HttpError(400, 'Message is empty.')
  if (text.length > 1000) throw new HttpError(400, 'Message is too long (max 1000 characters).')
  const chat = await ownedChat(visitorId, chatId)
  if (await limited('demo-msg', visitorId, 15, 60)) throw new HttpError(429, 'You are sending messages too quickly.')
  const today = (await sql`SELECT COUNT(*)::int AS n FROM demo_chat_messages WHERE visitor_id=${visitorId} AND role='user' AND created_at > now() - interval '1 day'`)[0].n
  if (today >= MAX_MESSAGES_PER_DAY) throw new HttpError(429, 'Daily demo message limit reached.')

  await sql`INSERT INTO demo_chat_messages (id, chat_id, visitor_id, role, content) VALUES (${newId()}, ${chatId}, ${visitorId}, 'user', ${text})`
  if (chat.title === 'Demo Chat') await sql`UPDATE demo_chats SET title=${text.slice(0, 60)} WHERE id=${chatId} AND visitor_id=${visitorId}`
  const history = (await sql`SELECT role, content FROM demo_chat_messages WHERE chat_id=${chatId} AND visitor_id=${visitorId} ORDER BY created_at DESC LIMIT 20`).reverse()
  const reply = (await generateDemoReply(history.map(h => ({ role: h.role, content: h.content })), visitorName))
    ?? 'The demo assistant is unavailable right now. Please try again in a moment.'
  const id = newId()
  await sql`INSERT INTO demo_chat_messages (id, chat_id, visitor_id, role, content) VALUES (${id}, ${chatId}, ${visitorId}, 'assistant', ${reply})`
  await sql`UPDATE demo_chats SET updated_at=now() WHERE id=${chatId} AND visitor_id=${visitorId}`
  return { id, role: 'assistant' as const, content: reply, created_at: new Date().toISOString() }
}

/** Admin only: PERMANENT delete. Messages are removed by ON DELETE CASCADE. The audit row keeps who/when/title, not content. */
export async function adminDeleteChat(chatId: string, adminId: string, m: { ip: string | null; ua: string }) {
  const c = (await sql`SELECT id, visitor_id, title FROM demo_chats WHERE id = ${chatId}`)[0]
  if (!c) throw new HttpError(404, 'Chat not found.')
  await sql`DELETE FROM demo_chats WHERE id = ${chatId}`
  await logAudit({ event: 'demo_chat_deleted', actor: 'admin', actorId: adminId, visitorId: c.visitor_id, ip: m.ip, ua: m.ua, meta: { chatId, title: c.title } })
}
