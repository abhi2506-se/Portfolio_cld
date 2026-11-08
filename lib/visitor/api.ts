import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { isMissingTable } from './db'
import { clientIp } from './ratelimit'
import { VISITOR_COOKIE } from './config'

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message) }
}
export const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } })

/** Wraps a handler: maps HttpError / missing-migration / unknown errors to safe JSON (no stack traces or SQL leak). */
export async function safe(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  try { return await fn() }
  catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status)
    if (isMissingTable(e)) return json({ error: 'Visitor system is not set up yet (database migration pending).' }, 503)
    console.error('[visitor-api]', e)
    return json({ error: 'Something went wrong. Please try again.' }, 500)
  }
}

export async function readJson(req: NextRequest): Promise<any> {
  try { return await req.json() } catch { throw new HttpError(400, 'Invalid request body') }
}

/** CSRF defence for cookie-authenticated mutations: Origin (or Referer) must match this host. */
export function assertSameOrigin(req: NextRequest) {
  const origin = req.headers.get('origin') || (() => { try { return new URL(req.headers.get('referer') || '').origin } catch { return '' } })()
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || ''
  let ok = false
  try { ok = !!origin && new URL(origin).host === host } catch {}
  if (!ok) throw new HttpError(403, 'Cross-origin request blocked')
}

export function adminOnly(req: NextRequest) {
  if (!requireAdmin(req)) throw new HttpError(401, 'Unauthorized')
}

export function reqMeta(req: NextRequest) {
  const ip = clientIp(req.headers)
  return { ip: ip === 'unknown' ? null : ip, ua: (req.headers.get('user-agent') || '').slice(0, 400) }
}

export function setSessionCookie(res: NextResponse, token: string, maxAgeSec: number) {
  res.cookies.set(VISITOR_COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: maxAgeSec,
  })
}
export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(VISITOR_COOKIE, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 })
}
