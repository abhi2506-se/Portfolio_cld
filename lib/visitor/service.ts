import { sql, Row } from './db'
import { HttpError } from './api'
import { logAudit } from './audit'
import { newId, newVisitorCode, randomToken, sha256, hashPassword, verifyPassword, dummyHash } from './crypto'
import { limited } from './ratelimit'
import { createSession, revokeSessions } from './auth'
import {
  ACTIVATION_TTL_MS, RESET_TTL_MS, DEFAULT_VALIDITY_DAYS, MAX_FAILED_LOGINS, LOCKOUT_MS, MAX_VALIDITY_DAYS,
} from './config'
import {
  sendVisitorEmail, approvalEmail, resetEmail, disabledEmail, enabledEmail, extendedEmail, securityAlertEmail,
} from './mailer'
import { z } from 'zod'
import { accessRequestSchema, passwordSchema } from './validation'

type Meta = { ip: string | null; ua: string }
const DAY = 24 * 60 * 60 * 1000

// ─── Public: request access ─────────────────────────────────────────────────────
export async function submitAccessRequest(input: z.infer<typeof accessRequestSchema>, m: Meta) {
  if (await limited('req-ip', m.ip || 'unknown', 5, 3600)) throw new HttpError(429, 'Too many requests. Please try again later.')
  if (await limited('req-email', input.email, 3, 86400)) throw new HttpError(429, 'Too many requests for this email. Please try again tomorrow.')

  const existing = await sql`SELECT 1 FROM visitors WHERE lower(email) = ${input.email} LIMIT 1`
  if (existing.length) throw new HttpError(409, 'An account already exists for this email. Please use Visitor Login.')
  const pending = await sql`SELECT 1 FROM visitor_access_requests WHERE lower(email) = ${input.email} AND status = 'pending' LIMIT 1`
  if (pending.length) throw new HttpError(409, 'A request for this email is already pending review.')

  const id = newId()
  try {
    await sql`INSERT INTO visitor_access_requests (id, full_name, email, mobile, company, designation, purpose, linkedin_url, website_url, ip_address, user_agent)
      VALUES (${id}, ${input.fullName}, ${input.email}, ${input.mobile}, ${input.company}, ${input.designation}, ${input.purpose},
              ${input.linkedinUrl}, ${input.websiteUrl}, ${m.ip}, ${m.ua})`
  } catch (e: any) {
    if (e?.code === '23505') throw new HttpError(409, 'A request for this email is already pending review.')
    throw e
  }
  await logAudit({ event: 'request_submitted', actor: 'visitor', requestId: id, ip: m.ip, ua: m.ua, meta: { email: input.email } })
  return { id }
}

// ─── Admin: approve / reject / create ───────────────────────────────────────────
async function issueToken(visitorId: string, type: 'activation' | 'password_reset', ttlMs: number, createdBy: string) {
  // One live token per type: older unused ones are invalidated.
  await sql`UPDATE visitor_auth_tokens SET used_at = now() WHERE visitor_id = ${visitorId} AND type = ${type} AND used_at IS NULL`
  const token = randomToken()
  await sql`INSERT INTO visitor_auth_tokens (id, visitor_id, type, token_hash, expires_at, created_by)
    VALUES (${newId()}, ${visitorId}, ${type}, ${sha256(token)}, ${new Date(Date.now() + ttlMs).toISOString()}, ${createdBy})`
  return token
}

async function sendActivation(v: Row, adminId: string) {
  const token = await issueToken(v.id, 'activation', ACTIVATION_TTL_MS, adminId)
  const mail = approvalEmail({ name: v.full_name, code: v.visitor_code, expiresAt: v.expires_at }, token, ACTIVATION_TTL_MS / 3600000)
  return sendVisitorEmail({ sender: 'approval', kind: 'approved_activation', to: v.email, visitorId: v.id, ...mail })
}

function clampDays(d: unknown): number {
  const n = Number(d)
  return Number.isInteger(n) && n >= 1 && n <= MAX_VALIDITY_DAYS ? n : DEFAULT_VALIDITY_DAYS
}

export async function approveRequest(requestId: string, adminId: string, validityDays: unknown, m: Meta) {
  // Atomic claim: only one concurrent approval can flip pending -> approved.
  const claimed = await sql`UPDATE visitor_access_requests SET status='approved', reviewed_at=now(), reviewed_by=${adminId}, updated_at=now()
    WHERE id = ${requestId} AND status = 'pending' RETURNING *`
  const r = claimed[0]
  if (!r) throw new HttpError(409, 'Request not found or already reviewed.')
  const dup = await sql`SELECT 1 FROM visitors WHERE lower(email) = lower(${r.email}) LIMIT 1`
  if (dup.length) {
    await sql`UPDATE visitor_access_requests SET status='pending', reviewed_at=NULL, reviewed_by=NULL WHERE id=${requestId}`
    throw new HttpError(409, 'A visitor account with this email already exists.')
  }
  const id = newId()
  const expires = new Date(Date.now() + clampDays(validityDays) * DAY)
  try {
    await sql`INSERT INTO visitors (id, visitor_code, request_id, full_name, email, mobile, company, designation, purpose, linkedin_url, website_url, expires_at, created_by)
      VALUES (${id}, ${newVisitorCode()}, ${requestId}, ${r.full_name}, ${String(r.email).toLowerCase()}, ${r.mobile}, ${r.company}, ${r.designation}, ${r.purpose},
              ${r.linkedin_url}, ${r.website_url}, ${expires.toISOString()}, ${adminId})`
  } catch (e) {
    await sql`UPDATE visitor_access_requests SET status='pending', reviewed_at=NULL, reviewed_by=NULL WHERE id=${requestId}`
    throw e
  }
  const v = (await sql`SELECT * FROM visitors WHERE id = ${id}`)[0]
  await logAudit({ event: 'account_approved', actor: 'admin', actorId: adminId, visitorId: id, requestId, ip: m.ip, ua: m.ua, meta: { validityDays: clampDays(validityDays) } })
  const mail = await sendActivation(v, adminId)
  return { visitorId: id, visitorCode: v.visitor_code, emailSent: mail.ok, emailError: mail.error }
}

export async function rejectRequest(requestId: string, adminId: string, reason: unknown, m: Meta) {
  const note = typeof reason === 'string' ? reason.trim().slice(0, 500) : ''
  const rows = await sql`UPDATE visitor_access_requests SET status='rejected', reviewed_at=now(), reviewed_by=${adminId}, reject_reason=${note || null}, updated_at=now()
    WHERE id = ${requestId} AND status='pending' RETURNING id`
  if (!rows.length) throw new HttpError(409, 'Request not found or already reviewed.')
  await logAudit({ event: 'account_rejected', actor: 'admin', actorId: adminId, requestId, ip: m.ip, ua: m.ua, meta: { reason: note || null } })
}

/** Admin creates an account directly (skips the public form); an already-approved request row is recorded for traceability. */
export async function createVisitorManually(input: z.infer<typeof accessRequestSchema>, validityDays: unknown, adminId: string, m: Meta) {
  const dup = await sql`SELECT 1 FROM visitors WHERE lower(email) = ${input.email} LIMIT 1`
  if (dup.length) throw new HttpError(409, 'A visitor account with this email already exists.')
  const reqId = newId()
  await sql`INSERT INTO visitor_access_requests (id, full_name, email, mobile, company, designation, purpose, linkedin_url, website_url, status, reviewed_at, reviewed_by)
    VALUES (${reqId}, ${input.fullName}, ${input.email}, ${input.mobile}, ${input.company}, ${input.designation}, ${input.purpose}, ${input.linkedinUrl}, ${input.websiteUrl}, 'approved', now(), ${adminId})`
  const id = newId()
  const expires = new Date(Date.now() + clampDays(validityDays) * DAY)
  await sql`INSERT INTO visitors (id, visitor_code, request_id, full_name, email, mobile, company, designation, purpose, linkedin_url, website_url, expires_at, created_by)
    VALUES (${id}, ${newVisitorCode()}, ${reqId}, ${input.fullName}, ${input.email}, ${input.mobile}, ${input.company}, ${input.designation}, ${input.purpose}, ${input.linkedinUrl}, ${input.websiteUrl}, ${expires.toISOString()}, ${adminId})`
  const v = (await sql`SELECT * FROM visitors WHERE id = ${id}`)[0]
  await logAudit({ event: 'account_created', actor: 'admin', actorId: adminId, visitorId: id, requestId: reqId, ip: m.ip, ua: m.ua })
  const mail = await sendActivation(v, adminId)
  return { visitorId: id, visitorCode: v.visitor_code, emailSent: mail.ok, emailError: mail.error }
}

// ─── Public: activation / reset token ───────────────────────────────────────────
export async function inspectToken(token: string): Promise<{ valid: boolean; type?: string }> {
  if (!token || token.length > 200) return { valid: false }
  const r = (await sql`SELECT t.type FROM visitor_auth_tokens t JOIN visitors v ON v.id = t.visitor_id
    WHERE t.token_hash = ${sha256(token)} AND t.used_at IS NULL AND t.expires_at > now() AND v.status <> 'disabled' LIMIT 1`)[0]
  return r ? { valid: true, type: r.type } : { valid: false }
}

export async function completeToken(token: string, password: string, m: Meta) {
  if (await limited('token-ip', m.ip || 'unknown', 20, 900)) throw new HttpError(429, 'Too many attempts. Please wait a few minutes.')
  const parsed = passwordSchema.safeParse(password)
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message || 'Invalid password')
  if (!token || token.length > 200) throw new HttpError(400, 'This link is invalid or has expired.')

  // One-time use, enforced atomically in the database.
  const claimed = await sql`UPDATE visitor_auth_tokens t SET used_at = now()
    FROM visitors v
    WHERE t.token_hash = ${sha256(token)} AND t.used_at IS NULL AND t.expires_at > now() AND v.id = t.visitor_id AND v.status <> 'disabled'
    RETURNING t.visitor_id, t.type`
  const c = claimed[0]
  if (!c) throw new HttpError(400, 'This link is invalid, already used, or has expired. Ask the portfolio owner for a new one.')

  const hash = await hashPassword(password)
  if (c.type === 'activation') {
    await sql`UPDATE visitors SET password_hash=${hash}, status='active', activated_at=COALESCE(activated_at, now()), failed_login_count=0, locked_until=NULL, updated_at=now() WHERE id=${c.visitor_id}`
    await logAudit({ event: 'account_activated', actor: 'visitor', actorId: c.visitor_id, visitorId: c.visitor_id, ip: m.ip, ua: m.ua })
  } else {
    await sql`UPDATE visitors SET password_hash=${hash}, status=CASE WHEN status='pending_activation' THEN 'active' ELSE status END, activated_at=COALESCE(activated_at, now()), failed_login_count=0, locked_until=NULL, updated_at=now() WHERE id=${c.visitor_id}`
    await revokeSessions(c.visitor_id, 'password_reset')
    await logAudit({ event: 'password_changed', actor: 'visitor', actorId: c.visitor_id, visitorId: c.visitor_id, ip: m.ip, ua: m.ua, meta: { via: 'reset_link' } })
  }
  return { type: c.type as string }
}

// ─── Public: login ──────────────────────────────────────────────────────────────
export async function login(email: string, password: string, m: Meta) {
  const e = String(email || '').trim().toLowerCase().slice(0, 254)
  if (!e || !password || String(password).length > 256) throw new HttpError(400, 'Email and password are required.')
  if (await limited('login-ip', m.ip || 'unknown', 20, 900) || await limited('login-email', e, 8, 900))
    throw new HttpError(429, 'Too many sign-in attempts. Please wait 15 minutes and try again.')

  const v = (await sql`SELECT * FROM visitors WHERE lower(email) = ${e} LIMIT 1`)[0]
  const GENERIC = new HttpError(401, 'Invalid email or password.')
  if (!v || !v.password_hash) {
    await verifyPassword(password, dummyHash()) // equalise timing
    await logAudit({ event: 'login_failed', actor: 'visitor', ip: m.ip, ua: m.ua, meta: { reason: 'unknown_account' } })
    throw GENERIC
  }
  if (v.locked_until && new Date(v.locked_until) > new Date()) {
    await logAudit({ event: 'login_failed', actor: 'visitor', visitorId: v.id, ip: m.ip, ua: m.ua, meta: { reason: 'locked' } })
    throw new HttpError(429, 'Account temporarily locked after repeated failed sign-ins. Try again later.')
  }
  const ok = await verifyPassword(password, v.password_hash)
  if (!ok) {
    const n = Number(v.failed_login_count) + 1
    const lock = n >= MAX_FAILED_LOGINS
    await sql`UPDATE visitors SET failed_login_count=${lock ? 0 : n}, locked_until=${lock ? new Date(Date.now() + LOCKOUT_MS).toISOString() : null} WHERE id=${v.id}`
    await logAudit({ event: 'login_failed', actor: 'visitor', visitorId: v.id, ip: m.ip, ua: m.ua, meta: { reason: 'bad_password' } })
    if (lock) {
      await logAudit({ event: 'account_locked', actor: 'system', visitorId: v.id, ip: m.ip, ua: m.ua })
      const mail = securityAlertEmail(v.full_name, 'your account was temporarily locked after several failed sign-in attempts.')
      void sendVisitorEmail({ sender: 'notifications', kind: 'security_alert', to: v.email, visitorId: v.id, ...mail })
    }
    throw GENERIC
  }
  // Password correct → it's safe to tell the user about account state.
  if (v.status === 'disabled') throw new HttpError(403, 'This account has been disabled. Please contact the portfolio owner.')
  if (v.status !== 'active') throw new HttpError(403, 'Please activate your account using the link sent to your email.')
  if (new Date(v.expires_at) <= new Date()) throw new HttpError(403, 'This account has expired. Please contact the portfolio owner to extend it.')

  const s = await createSession(v.id, m.ip, m.ua)
  await logAudit({ event: 'login_success', actor: 'visitor', actorId: v.id, visitorId: v.id, ip: m.ip, ua: m.ua })
  return s
}

// ─── Visitor: change own password ───────────────────────────────────────────────
export async function changePassword(visitorId: string, sessionId: string, current: string, next: string, m: Meta) {
  const parsed = passwordSchema.safeParse(next)
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message || 'Invalid password')
  if (await limited('pwchange', visitorId, 5, 900)) throw new HttpError(429, 'Too many attempts. Please wait.')
  const v = (await sql`SELECT password_hash, full_name, email FROM visitors WHERE id = ${visitorId}`)[0]
  if (!v?.password_hash || !(await verifyPassword(String(current || ''), v.password_hash))) throw new HttpError(400, 'Current password is incorrect.')
  await sql`UPDATE visitors SET password_hash=${await hashPassword(next)}, updated_at=now() WHERE id=${visitorId}`
  await revokeSessions(visitorId, 'password_changed', sessionId) // sign out every other device
  await logAudit({ event: 'password_changed', actor: 'visitor', actorId: visitorId, visitorId, ip: m.ip, ua: m.ua, meta: { via: 'dashboard' } })
  const mail = securityAlertEmail(v.full_name, 'your password was changed and other devices were signed out.')
  void sendVisitorEmail({ sender: 'notifications', kind: 'password_changed', to: v.email, visitorId, ...mail })
}

// ─── Admin account controls ─────────────────────────────────────────────────────
export async function adminSetEnabled(visitorId: string, enable: boolean, adminId: string, reason: unknown, m: Meta) {
  const note = typeof reason === 'string' ? reason.trim().slice(0, 300) : ''
  const v = (await sql`SELECT id, full_name, email, status, password_hash FROM visitors WHERE id=${visitorId}`)[0]
  if (!v) throw new HttpError(404, 'Visitor not found.')
  if (enable) {
    if (v.status !== 'disabled') throw new HttpError(409, 'Account is not disabled.')
    await sql`UPDATE visitors SET status=${v.password_hash ? 'active' : 'pending_activation'}, disabled_at=NULL, disabled_reason=NULL, updated_at=now() WHERE id=${visitorId}`
    await logAudit({ event: 'account_enabled', actor: 'admin', actorId: adminId, visitorId, ip: m.ip, ua: m.ua })
    const mail = enabledEmail(v.full_name)
    return sendVisitorEmail({ sender: 'notifications', kind: 'account_enabled', to: v.email, visitorId, ...mail })
  }
  await sql`UPDATE visitors SET status='disabled', disabled_at=now(), disabled_reason=${note || null}, updated_at=now() WHERE id=${visitorId}`
  const killed = await revokeSessions(visitorId, 'account_disabled') // immediate lock-out
  await logAudit({ event: 'account_disabled', actor: 'admin', actorId: adminId, visitorId, ip: m.ip, ua: m.ua, meta: { reason: note || null, sessionsRevoked: killed } })
  const mail = disabledEmail(v.full_name)
  return sendVisitorEmail({ sender: 'notifications', kind: 'account_disabled', to: v.email, visitorId, ...mail })
}

export async function adminResetPassword(visitorId: string, adminId: string, m: Meta) {
  const v = (await sql`SELECT id, full_name, email, status FROM visitors WHERE id=${visitorId}`)[0]
  if (!v) throw new HttpError(404, 'Visitor not found.')
  if (v.status === 'disabled') throw new HttpError(409, 'Enable the account before resetting its password.')
  await revokeSessions(visitorId, 'password_reset')
  const token = await issueToken(visitorId, 'password_reset', RESET_TTL_MS, adminId)
  await logAudit({ event: 'password_reset', actor: 'admin', actorId: adminId, visitorId, ip: m.ip, ua: m.ua })
  const mail = resetEmail(v.full_name, token, RESET_TTL_MS / 3600000)
  return sendVisitorEmail({ sender: 'notifications', kind: 'password_reset', to: v.email, visitorId, ...mail })
}

export async function adminResendActivation(visitorId: string, adminId: string, m: Meta) {
  const v = (await sql`SELECT * FROM visitors WHERE id=${visitorId}`)[0]
  if (!v) throw new HttpError(404, 'Visitor not found.')
  if (v.status !== 'pending_activation') throw new HttpError(409, 'Account is already activated.')
  await logAudit({ event: 'activation_resent', actor: 'admin', actorId: adminId, visitorId, ip: m.ip, ua: m.ua })
  return sendActivation(v, adminId)
}

export async function adminExtend(visitorId: string, adminId: string, input: { days?: unknown; date?: unknown }, m: Meta) {
  const v = (await sql`SELECT id, full_name, email, expires_at FROM visitors WHERE id=${visitorId}`)[0]
  if (!v) throw new HttpError(404, 'Visitor not found.')
  let next: Date
  if (typeof input.date === 'string' && input.date) {
    next = new Date(input.date)
    if (isNaN(next.getTime())) throw new HttpError(400, 'Invalid date.')
    // A date-only value means "end of that day" in IST.
    if (/^\d{4}-\d{2}-\d{2}$/.test(input.date)) next = new Date(`${input.date}T23:59:59+05:30`)
  } else {
    const d = Number(input.days)
    if (!Number.isInteger(d) || d < 1 || d > MAX_VALIDITY_DAYS) throw new HttpError(400, `Days must be 1–${MAX_VALIDITY_DAYS}.`)
    next = new Date(Math.max(Date.now(), new Date(v.expires_at).getTime()) + d * DAY)
  }
  if (next.getTime() > Date.now() + 2 * MAX_VALIDITY_DAYS * DAY) throw new HttpError(400, 'Expiry is too far in the future.')
  await sql`UPDATE visitors SET expires_at=${next.toISOString()}, expiry_reminder_sent_at=NULL, updated_at=now() WHERE id=${visitorId}`
  // If the new date is already in the past, access must end now.
  if (next.getTime() <= Date.now()) await revokeSessions(visitorId, 'account_expired')
  await logAudit({ event: 'expiry_extended', actor: 'admin', actorId: adminId, visitorId, ip: m.ip, ua: m.ua, meta: { from: v.expires_at, to: next.toISOString() } })
  if (next.getTime() > Date.now()) {
    const mail = extendedEmail(v.full_name, next)
    const r = await sendVisitorEmail({ sender: 'notifications', kind: 'expiry_extended', to: v.email, visitorId, ...mail })
    return { expiresAt: next.toISOString(), emailSent: r.ok, emailError: r.error }
  }
  return { expiresAt: next.toISOString(), emailSent: false }
}

export async function adminRevokeSessions(visitorId: string, adminId: string, m: Meta) {
  const n = await revokeSessions(visitorId, 'admin_revoked')
  await logAudit({ event: 'session_revoked', actor: 'admin', actorId: adminId, visitorId, ip: m.ip, ua: m.ua, meta: { count: n } })
  return n
}
