import { sql } from './db'
import { IP_RETENTION_DAYS, EXPIRY_REMINDER_DAYS, SESSION_IDLE_MS } from './config'
import { sendVisitorEmail, expiryReminderEmail } from './mailer'
import { revokeSessions } from './auth'

export async function runMaintenance() {
  const cutoff = new Date(Date.now() - IP_RETENTION_DAYS * 86400000).toISOString()
  // Anonymise (NULL) IPs older than 90 days — keeps the audit rows themselves.
  const a = await sql`UPDATE visitor_audit_logs SET ip_address=NULL, ip_anonymized_at=now() WHERE ip_address IS NOT NULL AND created_at < ${cutoff} RETURNING 1`
  const s = await sql`UPDATE visitor_sessions_auth SET ip_address=NULL, ip_anonymized_at=now() WHERE ip_address IS NOT NULL AND created_at < ${cutoff} RETURNING 1`
  const r = await sql`UPDATE visitor_access_requests SET ip_address=NULL, ip_anonymized_at=now() WHERE ip_address IS NOT NULL AND created_at < ${cutoff} RETURNING 1`

  // Close sessions that went idle (so "logout time" is populated and nothing lingers).
  const idle = await sql`UPDATE visitor_sessions_auth SET logout_at = last_active_at
    WHERE logout_at IS NULL AND revoked_at IS NULL AND last_active_at < ${new Date(Date.now() - SESSION_IDLE_MS).toISOString()} RETURNING 1`

  // Kill sessions of accounts that have expired.
  const expired = await sql`SELECT id FROM visitors WHERE status='active' AND expires_at <= now()
    AND EXISTS (SELECT 1 FROM visitor_sessions_auth s WHERE s.visitor_id=visitors.id AND s.revoked_at IS NULL AND s.logout_at IS NULL)`
  for (const v of expired) await revokeSessions(v.id, 'account_expired')

  // One expiry reminder per expiry date.
  const soon = await sql`SELECT id, full_name, email, expires_at FROM visitors
    WHERE status='active' AND expires_at > now() AND expires_at < now() + ${EXPIRY_REMINDER_DAYS + ' days'}::interval AND expiry_reminder_sent_at IS NULL LIMIT 50`
  let reminders = 0
  for (const v of soon) {
    const mail = expiryReminderEmail(v.full_name, v.expires_at)
    const res = await sendVisitorEmail({ sender: 'notifications', kind: 'expiry_reminder', to: v.email, visitorId: v.id, ...mail })
    if (res.ok) { await sql`UPDATE visitors SET expiry_reminder_sent_at=now() WHERE id=${v.id}`; reminders++ }
  }
  return { ipAnonymized: a.length + s.length + r.length, idleSessionsClosed: idle.length, expiredSessionsRevoked: expired.length, remindersSent: reminders }
}
