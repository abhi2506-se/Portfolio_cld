import { NextRequest } from 'next/server'
import { sql, Row } from './db'
import { newId, randomToken, sha256 } from './crypto'
import { HttpError } from './api'
import { VISITOR_COOKIE, SESSION_ABSOLUTE_MS, SESSION_IDLE_MS, HEARTBEAT_MAX_CREDIT_S } from './config'
import { parseUserAgent } from './ua'

export interface AuthedVisitor {
  visitorId: string
  visitorCode: string
  fullName: string
  email: string
  mobile: string
  company: string
  designation: string
  purpose: string
  linkedinUrl: string | null
  websiteUrl: string | null
  expiresAt: string
  activatedAt: string | null
  lastLoginAt: string | null
  sessionId: string
  sessionLoginAt: string
  sessionLastActiveAt: string
  sessionExpiresAt: string
}

/**
 * THE single source of truth for "who is this visitor". Hits the DB on every call so that
 * disabling, expiring or revoking takes effect on the very next request.
 * The visitor id ALWAYS comes from here — never from query/body parameters.
 */
export async function getAuthedVisitor(req: NextRequest): Promise<AuthedVisitor | null> {
  const raw = req.cookies.get(VISITOR_COOKIE)?.value
  if (!raw || raw.length < 20 || raw.length > 200) return null
  const idleCutoff = new Date(Date.now() - SESSION_IDLE_MS)
  const rows = await sql`
    SELECT v.id AS visitor_id, v.visitor_code, v.full_name, v.email, v.mobile, v.company, v.designation, v.purpose,
           v.linkedin_url, v.website_url, v.expires_at, v.activated_at, v.last_login_at,
           s.id AS session_id, s.login_at, s.last_active_at, s.expires_at AS session_expires_at
    FROM visitor_sessions_auth s
    JOIN visitors v ON v.id = s.visitor_id
    WHERE s.token_hash = ${sha256(raw)}
      AND s.revoked_at IS NULL AND s.logout_at IS NULL
      AND s.expires_at > now() AND s.last_active_at > ${idleCutoff.toISOString()}
      AND v.status = 'active' AND v.expires_at > now()
    LIMIT 1`
  const r = rows[0]
  if (!r) return null
  return {
    visitorId: r.visitor_id, visitorCode: r.visitor_code, fullName: r.full_name, email: r.email, mobile: r.mobile,
    company: r.company, designation: r.designation, purpose: r.purpose, linkedinUrl: r.linkedin_url, websiteUrl: r.website_url,
    expiresAt: new Date(r.expires_at).toISOString(), activatedAt: r.activated_at ? new Date(r.activated_at).toISOString() : null,
    lastLoginAt: r.last_login_at ? new Date(r.last_login_at).toISOString() : null,
    sessionId: r.session_id, sessionLoginAt: new Date(r.login_at).toISOString(),
    sessionLastActiveAt: new Date(r.last_active_at).toISOString(), sessionExpiresAt: new Date(r.session_expires_at).toISOString(),
  }
}

export async function requireVisitor(req: NextRequest): Promise<AuthedVisitor> {
  const a = await getAuthedVisitor(req)
  if (!a) throw new HttpError(401, 'Please sign in again.')
  return a
}

export async function createSession(visitorId: string, ip: string | null, ua: string) {
  const token = randomToken()
  const info = parseUserAgent(ua)
  const expires = new Date(Date.now() + SESSION_ABSOLUTE_MS)
  await sql`INSERT INTO visitor_sessions_auth (id, visitor_id, token_hash, expires_at, device_category, browser, os, ip_address)
    VALUES (${newId()}, ${visitorId}, ${sha256(token)}, ${expires.toISOString()}, ${info.deviceCategory}, ${info.browser}, ${info.os}, ${ip})`
  await sql`UPDATE visitors SET last_login_at = now(), failed_login_count = 0, locked_until = NULL, updated_at = now() WHERE id = ${visitorId}`
  return { token, maxAgeSec: Math.floor(SESSION_ABSOLUTE_MS / 1000) }
}

/** Credits online time (capped) and refreshes activity. Called by the heartbeat. */
export async function heartbeat(a: AuthedVisitor) {
  const gap = Math.max(0, Math.round((Date.now() - new Date(a.sessionLastActiveAt).getTime()) / 1000))
  const credit = Math.min(gap, HEARTBEAT_MAX_CREDIT_S)
  await sql`UPDATE visitor_sessions_auth SET last_active_at = now(), online_seconds = online_seconds + ${credit} WHERE id = ${a.sessionId}`
  await sql`UPDATE visitors SET total_online_seconds = total_online_seconds + ${credit} WHERE id = ${a.visitorId}`
}

export async function endSession(sessionId: string) {
  await sql`UPDATE visitor_sessions_auth SET logout_at = now() WHERE id = ${sessionId} AND logout_at IS NULL AND revoked_at IS NULL`
}

/** Immediately kills sessions. exceptSessionId lets "sign out other devices" keep the current one. */
export async function revokeSessions(visitorId: string, reason: string, exceptSessionId?: string): Promise<number> {
  const rows = await sql`UPDATE visitor_sessions_auth SET revoked_at = now(), revoked_reason = ${reason}
    WHERE visitor_id = ${visitorId} AND revoked_at IS NULL AND logout_at IS NULL AND id <> ${exceptSessionId ?? ''}
    RETURNING id`
  return rows.length
}

export type { Row }
