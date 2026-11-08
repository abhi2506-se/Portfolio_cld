import nodemailer from 'nodemailer'
import { sql } from './db'
import { newId } from './crypto'
import { APPROVAL_FROM, NOTIFICATIONS_FROM, SITE_URL } from './config'
import { withNoReplyNotice } from '@/lib/mail-identities'

export type SenderType = 'approval' | 'notifications'
export type MailKind =
  | 'approved_activation' | 'password_reset' | 'expiry_reminder' | 'account_disabled'
  | 'account_enabled' | 'expiry_extended' | 'security_alert' | 'password_changed'

const FROM: Record<SenderType, string> = { approval: APPROVAL_FROM, notifications: NOTIFICATIONS_FROM }
const addrOf = (from: string) => (from.match(/<([^>]+)>/)?.[1] || from).trim()

/**
 * Reuses the project's existing SMTP_* env vars. Defaults are Titan's
 * (smtp.titan.email, 465/SSL); set SMTP_HOST/SMTP_PORT/SMTP_SECURE to override.
 */
function transporter() {
  const port = Number(process.env.SMTP_PORT) || 465
  const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.titan.email',
    port, secure,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  })
}

export const mailConfigured = () => !!(process.env.SMTP_USER && process.env.SMTP_PASS)

/** Turns an SMTP failure into an actionable message for the admin (never includes credentials). */
function explain(err: any, from: string): string {
  const code = err?.responseCode
  const msg = String(err?.message || err).replace(/pass(word)?=\S+/gi, '***').slice(0, 300)
  if (err?.code === 'EAUTH' || code === 535) return 'SMTP authentication failed — check SMTP_USER / SMTP_PASS (Titan mailbox password).'
  if (code === 550 || code === 553 || code === 554 || err?.code === 'EENVELOPE')
    return `Titan refused sender ${addrOf(from)}. This address must be a mailbox of its own or an alias of SMTP_USER that is allowed to send (Titan Control Panel → Email → alias / "send as"). Raw: ${msg}`
  if (err?.code === 'ECONNECTION' || err?.code === 'ETIMEDOUT' || err?.code === 'ESOCKET')
    return `Cannot reach SMTP server — check SMTP_HOST / SMTP_PORT / SMTP_SECURE. Raw: ${msg}`
  return msg
}

export async function sendVisitorEmail(p: {
  sender: SenderType; kind: MailKind; to: string; visitorId?: string | null
  subject: string; html: string; text: string
}): Promise<{ ok: boolean; error?: string }> {
  const from = FROM[p.sender]
  const logId = newId()
  try {
    await sql`INSERT INTO visitor_email_logs (id, visitor_id, sender_type, from_address, to_email, notification_type, status)
      VALUES (${logId}, ${p.visitorId ?? null}, ${p.sender}, ${addrOf(from)}, ${p.to}, ${p.kind}, 'queued')`
  } catch (e) { console.error('[visitor-mail] log insert failed', e) }

  try {
    if (!mailConfigured()) throw Object.assign(new Error('SMTP_USER / SMTP_PASS are not configured'), { code: 'ENOCONFIG' })
    const info = await transporter().sendMail({ from, to: p.to, subject: p.subject, html: withNoReplyNotice(p.html), text: p.text })
    await sql`UPDATE visitor_email_logs SET status='sent', sent_at=now(), provider_message_id=${String(info.messageId || '').slice(0, 200)} WHERE id=${logId}`.catch(() => {})
    return { ok: true }
  } catch (err) {
    const reason = err instanceof Error && (err as any).code === 'ENOCONFIG' ? err.message : explain(err, from)
    await sql`UPDATE visitor_email_logs SET status='failed', error_message=${reason} WHERE id=${logId}`.catch(() => {})
    console.error('[visitor-mail] send failed:', reason)
    return { ok: false, error: reason }
  }
}

// ─── Templates (portfolio branding; inline CSS for email-client safety) ─────────
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

function layout(o: { title: string; intro: string; bodyHtml?: string; cta?: { label: string; url: string }; footnote?: string }) {
  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
<tr><td style="background:linear-gradient(135deg,#2563eb,#7c3aed);padding:28px 32px;"><p style="margin:0;color:#fff;font-size:13px;letter-spacing:.12em;text-transform:uppercase;opacity:.85;">Abhishek Singh · Portfolio</p>
<h1 style="margin:8px 0 0;color:#fff;font-size:22px;line-height:1.3;">${esc(o.title)}</h1></td></tr>
<tr><td style="padding:28px 32px;color:#0f172a;font-size:15px;line-height:1.65;">
<p style="margin:0 0 16px;">${o.intro}</p>${o.bodyHtml || ''}
${o.cta ? `<p style="margin:24px 0;"><a href="${esc(o.cta.url)}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:10px;">${esc(o.cta.label)}</a></p>
<p style="margin:0 0 8px;font-size:12px;color:#64748b;word-break:break-all;">Button not working? Copy this link:<br>${esc(o.cta.url)}</p>` : ''}
${o.footnote ? `<p style="margin:16px 0 0;font-size:12px;color:#64748b;">${o.footnote}</p>` : ''}
</td></tr>
<tr><td style="padding:16px 32px;background:#f8fafc;color:#64748b;font-size:11px;">${SITE_URL.replace('https://', '')} · Visitor access is private and monitored for security.</td></tr>
</table></td></tr></table></body></html>`
}
const fmtDate = (d: Date | string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })
const row = (k: string, v: string) => `<tr><td style="padding:4px 12px 4px 0;color:#64748b;">${k}</td><td style="padding:4px 0;font-weight:600;">${esc(v)}</td></tr>`

export const activationUrl = (token: string) => `${SITE_URL}/visitor/activate?token=${encodeURIComponent(token)}`
export const resetUrl = (token: string) => `${SITE_URL}/visitor/activate?token=${encodeURIComponent(token)}&mode=reset`

export function approvalEmail(v: { name: string; code: string; expiresAt: Date | string }, token: string, hours: number) {
  const url = activationUrl(token)
  return {
    subject: 'Your visitor access has been approved',
    text: `Hi ${v.name},\n\nYour request for visitor access was approved. Your Visitor ID is ${v.code}.\nSet your password and activate your account (link valid ${hours} hours, single use):\n${url}\n\nAccess is valid until ${fmtDate(v.expiresAt)}. We never email passwords.`,
    html: layout({
      title: 'Visitor access approved',
      intro: `Hi ${esc(v.name)}, your request to explore the portfolio as a visitor has been approved.`,
      bodyHtml: `<table role="presentation" style="margin:8px 0 0;font-size:14px;">${row('Visitor ID', v.code)}${row('Valid until', fmtDate(v.expiresAt))}</table>
<p style="margin:16px 0 0;">Next step: open the secure link below and choose your own password. Then sign in at <b>/visitor/login</b> using your email address.</p>`,
      cta: { label: 'Activate my account', url },
      footnote: `This link works once and expires in ${hours} hours. For your security we never send passwords by email.`,
    }),
  }
}

export function resetEmail(name: string, token: string, hours: number) {
  const url = resetUrl(token)
  return {
    subject: 'Reset your visitor password',
    text: `Hi ${name},\n\nA password reset was requested for your visitor account. Choose a new password (single-use link, valid ${hours} hours):\n${url}\n\nIf you did not expect this, you can ignore this email.`,
    html: layout({ title: 'Reset your password', intro: `Hi ${esc(name)}, a password reset was started for your visitor account.`, cta: { label: 'Choose a new password', url }, footnote: `Single-use link, valid for ${hours} hours. All existing sessions were signed out. If you did not expect this, ignore this email.` }),
  }
}

export function expiryReminderEmail(name: string, expiresAt: Date | string) {
  return {
    subject: 'Your visitor access expires soon',
    text: `Hi ${name}, your visitor access expires on ${fmtDate(expiresAt)}. Reply to the portfolio owner if you need more time.`,
    html: layout({ title: 'Access expiring soon', intro: `Hi ${esc(name)}, your visitor access will expire on <b>${fmtDate(expiresAt)}</b>.`, bodyHtml: `<p style="margin:0;">If you need more time, please contact Abhishek and he can extend it.</p>`, cta: { label: 'Open visitor login', url: `${SITE_URL}/visitor/login` } }),
  }
}

export function disabledEmail(name: string) {
  return {
    subject: 'Your visitor account has been disabled',
    text: `Hi ${name}, your visitor account has been disabled and active sessions were signed out. Contact the portfolio owner if you think this is a mistake.`,
    html: layout({ title: 'Account disabled', intro: `Hi ${esc(name)}, your visitor account has been disabled and all active sessions were signed out.`, bodyHtml: `<p style="margin:0;">If you believe this is a mistake, please contact Abhishek.</p>` }),
  }
}

export function enabledEmail(name: string) {
  return {
    subject: 'Your visitor account is active again',
    text: `Hi ${name}, your visitor account has been re-enabled. You can sign in again.`,
    html: layout({ title: 'Account re-enabled', intro: `Hi ${esc(name)}, your visitor account has been re-enabled.`, cta: { label: 'Sign in', url: `${SITE_URL}/visitor/login` } }),
  }
}

export function extendedEmail(name: string, expiresAt: Date | string) {
  return {
    subject: 'Your visitor access was extended',
    text: `Hi ${name}, your visitor access is now valid until ${fmtDate(expiresAt)}.`,
    html: layout({ title: 'Access extended', intro: `Hi ${esc(name)}, your visitor access is now valid until <b>${fmtDate(expiresAt)}</b>.`, cta: { label: 'Open dashboard', url: `${SITE_URL}/visitor/dashboard` } }),
  }
}

export function securityAlertEmail(name: string, what: string) {
  return {
    subject: 'Security alert on your visitor account',
    text: `Hi ${name}, ${what} If this wasn't you, contact the portfolio owner immediately.`,
    html: layout({ title: 'Security alert', intro: `Hi ${esc(name)}, ${esc(what)}`, bodyHtml: `<p style="margin:0;">If this wasn't you, contact Abhishek immediately.</p>` }),
  }
}
