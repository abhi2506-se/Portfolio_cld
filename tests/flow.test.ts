import { describe, it, expect, vi, beforeAll } from 'vitest'

const sent: any[] = []
vi.mock('nodemailer', () => ({ default: { createTransport: () => ({ sendMail: async (o: any) => { sent.push(o); return { messageId: '<test@local>' } } }) } }))
vi.mock('@/lib/neon-lazy', async () => { const { makeDb } = await import('./helpers'); const { tag } = await makeDb(); return { lazySql: tag } })

process.env.SMTP_USER = 'test-mailbox@example.com'
process.env.SMTP_PASS = 'not-a-real-password'

import { sql } from '@/lib/visitor/db'
import * as svc from '@/lib/visitor/service'
import { getAuthedVisitor, heartbeat } from '@/lib/visitor/auth'
import * as demo from '@/lib/visitor/demo'
import { getStats, getVisitorDetail } from '@/lib/visitor/admin-queries'
import { runMaintenance } from '@/lib/visitor/maintenance'
import { HttpError } from '@/lib/visitor/api'

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit Safari/604'
const meta = (n: number) => ({ ip: `10.0.0.${n}`, ua: UA })
const reqWith = (token: string) => ({ cookies: { get: (n: string) => (n === 'visitor_session' ? { value: token } : undefined) } }) as any
const tokenFrom = (html: string) => decodeURIComponent(html.match(/token=([^"&\s]+)/)![1])
const rejects = async (p: Promise<any>, status: number) => { try { await p } catch (e: any) { expect(e).toBeInstanceOf(HttpError); expect(e.status).toBe(status); return } throw new Error('expected rejection') }

const form = (email: string) => ({ fullName: 'Asha Rao', email, mobile: '+919876543210', company: 'Corp', designation: 'CTO', purpose: 'Evaluating your portfolio', linkedinUrl: null, websiteUrl: null })
const PW = 'GoodPassw0rd!'

async function onboard(email: string, ipn: number) {
  const { id } = await svc.submitAccessRequest(form(email), meta(ipn))
  const a = await svc.approveRequest(id, 'admin', 30, meta(ipn))
  const mail = sent.filter(s => s.to === email).pop()
  await svc.completeToken(tokenFrom(mail.html), PW, meta(ipn))
  return { requestId: id, visitorId: a.visitorId }
}

describe('visitor lifecycle (real Postgres semantics)', () => {
  it('request → approve → activate (one-time token) → login', async () => {
    const { id } = await svc.submitAccessRequest(form('a@corp.com'), meta(1))
    await rejects(svc.submitAccessRequest(form('A@corp.com'), meta(1)), 409)            // duplicate pending
    const r = await svc.approveRequest(id, 'admin', 30, meta(1))
    expect(r.emailSent).toBe(true)
    await rejects(svc.approveRequest(id, 'admin', 30, meta(1)), 409)                     // double-approve blocked

    const v = (await sql`SELECT * FROM visitors WHERE id=${r.visitorId}`)[0]
    expect(v.status).toBe('pending_activation'); expect(v.password_hash).toBeNull()
    const days = (new Date(v.expires_at).getTime() - Date.now()) / 86400000
    expect(days).toBeGreaterThan(29); expect(days).toBeLessThan(30.1)                    // default 30-day validity

    const mail = sent.find(s => s.to === 'a@corp.com')
    expect(mail.from).toContain('visitors_approval@theabhisheksingh.in')
    expect(mail.html).toContain('https://www.theabhisheksingh.in/visitor/activate?token=')
    expect(mail.html).not.toContain(PW)
    const token = tokenFrom(mail.html)

    await rejects(svc.login('a@corp.com', PW, meta(1)), 401)                             // can't log in before activation
    await rejects(svc.completeToken(token, 'weak', meta(1)), 400)                        // policy enforced
    await svc.completeToken(token, PW, meta(1))
    await rejects(svc.completeToken(token, PW, meta(1)), 400)                            // one-time use

    const s = await svc.login('a@corp.com', PW, meta(1))
    const a = await getAuthedVisitor(reqWith(s.token))
    expect(a?.email).toBe('a@corp.com')
    const hashStored = (await sql`SELECT token_hash FROM visitor_sessions_auth`)[0].token_hash
    expect(hashStored).not.toBe(s.token)                                                 // raw token never stored
    const sess = (await sql`SELECT * FROM visitor_sessions_auth`)[0]
    expect(sess.device_category).toBe('mobile'); expect(sess.browser).toBe('Safari'); expect(sess.os).toBe('iOS'); expect(sess.ip_address).toBe('10.0.0.1')
  })

  it('disable / expiry / revoke cut access on the very next request', async () => {
    const { visitorId } = await onboard('b@corp.com', 2)
    const s = await svc.login('b@corp.com', PW, meta(2))
    expect(await getAuthedVisitor(reqWith(s.token))).not.toBeNull()

    const before = sent.length
    await svc.adminSetEnabled(visitorId, false, 'admin', 'testing', meta(2))
    expect(await getAuthedVisitor(reqWith(s.token))).toBeNull()                          // immediate
    expect(sent.length).toBe(before + 1); expect(sent[sent.length - 1].from).toContain('visitors_notifications@')
    await rejects(svc.login('b@corp.com', PW, meta(2)), 403)

    await svc.adminSetEnabled(visitorId, true, 'admin', null, meta(2))
    const s2 = await svc.login('b@corp.com', PW, meta(2))
    expect(await getAuthedVisitor(reqWith(s2.token))).not.toBeNull()

    await svc.adminRevokeSessions(visitorId, 'admin', meta(2))
    expect(await getAuthedVisitor(reqWith(s2.token))).toBeNull()

    const s3 = await svc.login('b@corp.com', PW, meta(2))
    await sql`UPDATE visitors SET expires_at = now() - interval '1 minute' WHERE id=${visitorId}`
    expect(await getAuthedVisitor(reqWith(s3.token))).toBeNull()                         // expired → blocked
    await rejects(svc.login('b@corp.com', PW, meta(2)), 403)
    const ext = await svc.adminExtend(visitorId, 'admin', { days: 10 }, meta(2))
    expect(new Date(ext.expiresAt).getTime()).toBeGreaterThan(Date.now())
    expect(await svc.login('b@corp.com', PW, meta(2))).toBeTruthy()                     // extension restores login
  })

  it('password reset: emails a link (not a password), revokes sessions, old password dies', async () => {
    const { visitorId } = await onboard('c@corp.com', 3)
    const s = await svc.login('c@corp.com', PW, meta(3))
    const r = await svc.adminResetPassword(visitorId, 'admin', meta(3))
    expect(r.ok).toBe(true)
    const mail = sent[sent.length - 1]
    expect(mail.from).toContain('visitors_notifications@'); expect(mail.html).toContain('mode=reset')
    expect(await getAuthedVisitor(reqWith(s.token))).toBeNull()
    await svc.completeToken(tokenFrom(mail.html), 'BrandNewPass9x', meta(3))
    await rejects(svc.login('c@corp.com', PW, meta(3)), 401)
    expect(await svc.login('c@corp.com', 'BrandNewPass9x', meta(3))).toBeTruthy()
  })

  it('locks the account after repeated failures and never reveals which emails exist', async () => {
    await onboard('d@corp.com', 4)
    for (let i = 0; i < 5; i++) await rejects(svc.login('d@corp.com', 'wrong-password', meta(4)), 401)
    await rejects(svc.login('d@corp.com', PW, meta(4)), 429)                              // locked even with right password
    await rejects(svc.login('nobody@corp.com', 'x', meta(5)), 401)                         // same message as wrong password
  })

  it('heartbeat credits capped online time', async () => {
    const { visitorId } = await onboard('e@corp.com', 6)
    const s = await svc.login('e@corp.com', PW, meta(6))
    await sql`UPDATE visitor_sessions_auth SET last_active_at = now() - interval '20 seconds' WHERE visitor_id=${visitorId}`
    await heartbeat((await getAuthedVisitor(reqWith(s.token)))!)
    let row = (await sql`SELECT online_seconds FROM visitor_sessions_auth WHERE visitor_id=${visitorId}`)[0]
    expect(row.online_seconds).toBeGreaterThanOrEqual(19); expect(row.online_seconds).toBeLessThanOrEqual(22)
    await sql`UPDATE visitor_sessions_auth SET last_active_at = now() - interval '20 minutes' WHERE visitor_id=${visitorId}`
    const before = row.online_seconds
    await heartbeat({ ...(await getAuthedVisitor(reqWith(s.token)))!, sessionLastActiveAt: new Date(Date.now() - 20 * 60000).toISOString() } as any)
    row = (await sql`SELECT online_seconds FROM visitor_sessions_auth WHERE visitor_id=${visitorId}`)[0]
    expect(row.online_seconds - before).toBeLessThanOrEqual(90)                           // stalled tab can't inflate time
  })

  it('demo chats are private per visitor (IDOR) and separate from live chat tables', async () => {
    const A = await onboard('f@corp.com', 7); const B = await onboard('g@corp.com', 8)
    const chatA = await demo.createChat(A.visitorId, meta(7))
    const chatB = await demo.createChat(B.visitorId, meta(8))
    await demo.sendMessage(A.visitorId, 'Asha', chatA.id, 'hello from A')
    await rejects(demo.getMessages(B.visitorId, chatA.id), 404)                           // B can't read A's chat
    await rejects(demo.sendMessage(B.visitorId, 'Bob', chatA.id, 'injected'), 404)        // …or write into it
    await rejects(demo.sendMessage(A.visitorId, 'Asha', 'not-a-real-id', 'x'), 404)
    expect((await demo.listChats(B.visitorId)).map((c: any) => c.id)).toEqual([chatB.id])
    expect((await demo.getMessages(A.visitorId, chatA.id)).length).toBe(2)               // user msg + assistant fallback
    const stray = await sql`SELECT COUNT(*)::int n FROM demo_chat_messages WHERE content='injected'`
    expect(stray[0].n).toBe(0)
    await rejects(demo.sendMessage(A.visitorId, 'Asha', chatA.id, 'x'.repeat(1001)), 400)
    expect((await getVisitorDetail(A.visitorId)).demoChats.length).toBe(1)
    const audit = await sql`SELECT 1 FROM visitor_audit_logs WHERE event_type='demo_chat_created' AND visitor_id=${A.visitorId}`
    expect(audit.length).toBe(1)
  })

  it('admin stats, audit trail and email log are populated', async () => {
    const st = await getStats()
    expect(st.total_visitors).toBeGreaterThanOrEqual(6); expect(st.total_demo_chats).toBe(2)
    expect(st.disabled_accounts).toBe(0); expect(st.expired_accounts).toBe(0)
    const ev = (await sql`SELECT DISTINCT event_type FROM visitor_audit_logs`).map((r: any) => r.event_type)
    for (const e of ['request_submitted', 'account_approved', 'account_activated', 'login_success', 'login_failed', 'account_disabled', 'password_reset', 'session_revoked', 'expiry_extended', 'demo_chat_created']) expect(ev).toContain(e)
    const logs = await sql`SELECT sender_type, from_address, status, notification_type FROM visitor_email_logs`
    expect(logs.every((l: any) => l.status === 'sent')).toBe(true)
    expect(logs.filter((l: any) => l.sender_type === 'approval').every((l: any) => l.from_address === 'visitors_approval@theabhisheksingh.in')).toBe(true)
    expect(logs.filter((l: any) => l.sender_type === 'notifications').every((l: any) => l.from_address === 'visitors_notifications@theabhisheksingh.in')).toBe(true)
  })

  it('cron anonymises IPs older than 90 days and keeps recent ones', async () => {
    await sql`UPDATE visitor_audit_logs SET created_at = now() - interval '91 days' WHERE event_type='request_submitted' AND ip_address='10.0.0.1'`
    const recent = (await sql`SELECT COUNT(*)::int n FROM visitor_audit_logs WHERE ip_address IS NOT NULL AND created_at > now() - interval '90 days'`)[0].n
    const r = await runMaintenance()
    expect(r.ipAnonymized).toBeGreaterThan(0)
    expect((await sql`SELECT COUNT(*)::int n FROM visitor_audit_logs WHERE ip_address IS NOT NULL AND created_at < now() - interval '90 days'`)[0].n).toBe(0)
    expect((await sql`SELECT COUNT(*)::int n FROM visitor_audit_logs WHERE ip_address IS NOT NULL AND created_at > now() - interval '90 days'`)[0].n).toBe(recent)
  })

  it('expiry reminder is sent once per expiry date', async () => {
    const { visitorId } = await onboard('h@corp.com', 9)
    await sql`UPDATE visitors SET expires_at = now() + interval '2 days' WHERE id=${visitorId}`
    const n0 = sent.length
    expect((await runMaintenance()).remindersSent).toBe(1)
    expect(sent[n0].subject).toMatch(/expires soon/); expect(sent[n0].from).toContain('visitors_notifications@')
    expect((await runMaintenance()).remindersSent).toBe(0)
  })
})

describe('admin permanent delete of demo chats', () => {
  it('removes the chat and its messages for good, and writes an audit row', async () => {
    const A = await onboard('del@corp.com', 11)
    const c = await demo.createChat(A.visitorId, meta(11))
    await demo.sendMessage(A.visitorId, 'Del', c.id, 'delete me')
    const { adminDeleteChat } = await import('@/lib/visitor/demo')
    await adminDeleteChat(c.id, 'admin', meta(11))
    expect((await sql`SELECT 1 FROM demo_chats WHERE id=${c.id}`).length).toBe(0)
    expect((await sql`SELECT 1 FROM demo_chat_messages WHERE chat_id=${c.id}`).length).toBe(0)
    expect((await sql`SELECT 1 FROM visitor_audit_logs WHERE event_type='demo_chat_deleted' AND visitor_id=${A.visitorId}`).length).toBe(1)
    await rejects(adminDeleteChat(c.id, 'admin', meta(11)), 404)
  })
})

describe('section access granted by admin', () => {
  it('sections are locked by default and open only after admin enables them', async () => {
    const { visitorId } = await onboard('feat@corp.com', 12)
    const { getFeatureAccess, requireFeature, adminSetFeature } = await import('@/lib/visitor/permissions')
    expect(await getFeatureAccess(visitorId)).toEqual({ explorer: false, demo_chat: false })
    await rejects(requireFeature(visitorId, 'demo_chat'), 403)
    await rejects(requireFeature(visitorId, 'explorer'), 403)
    await adminSetFeature(visitorId, 'demo_chat', true, 'admin', meta(12))
    await requireFeature(visitorId, 'demo_chat')
    expect((await getFeatureAccess(visitorId)).demo_chat).toBe(true)
    expect((await getFeatureAccess(visitorId)).explorer).toBe(false)
    await adminSetFeature(visitorId, 'demo_chat', false, 'admin', meta(12))
    await rejects(requireFeature(visitorId, 'demo_chat'), 403)
  })
})
