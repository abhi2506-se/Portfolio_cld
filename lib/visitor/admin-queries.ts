import { sql } from './db'
import { ONLINE_WINDOW_MS } from './config'
import { HttpError } from './api'
import { getFeatureAccess } from './permissions'

const online = () => new Date(Date.now() - ONLINE_WINDOW_MS).toISOString()

export async function getStats() {
  const r = (await sql`
    SELECT
      (SELECT COUNT(*) FROM visitors)::int                                                              AS total_visitors,
      (SELECT COUNT(*) FROM visitor_access_requests WHERE status='pending')::int                        AS pending_requests,
      (SELECT COUNT(*) FROM visitor_access_requests WHERE status='approved')::int                       AS approved_visitors,
      (SELECT COUNT(*) FROM visitor_access_requests WHERE status='rejected')::int                       AS rejected_requests,
      (SELECT COUNT(*) FROM visitors WHERE status='active' AND expires_at > now())::int                 AS active_accounts,
      (SELECT COUNT(*) FROM visitors WHERE status='disabled')::int                                      AS disabled_accounts,
      (SELECT COUNT(*) FROM visitors WHERE status <> 'disabled' AND expires_at <= now())::int           AS expired_accounts,
      (SELECT COUNT(DISTINCT s.visitor_id) FROM visitor_sessions_auth s JOIN visitors v ON v.id=s.visitor_id
         WHERE s.revoked_at IS NULL AND s.logout_at IS NULL AND s.expires_at > now()
           AND s.last_active_at > ${online()} AND v.status='active' AND v.expires_at > now())::int        AS online_visitors,
      (SELECT COUNT(*) FROM demo_chats)::int                                                            AS total_demo_chats`)[0]
  return r
}

export async function listRequests(status: string) {
  const s = ['pending', 'approved', 'rejected'].includes(status) ? status : null
  return sql`SELECT id, full_name, email, mobile, company, designation, purpose, linkedin_url, website_url, status,
      reviewed_at, reject_reason, ip_address, created_at
    FROM visitor_access_requests WHERE (${s}::text IS NULL OR status = ${s}) ORDER BY created_at DESC LIMIT 300`
}

export async function listVisitors(filter: string, q: string) {
  const f = ['active', 'disabled', 'expired', 'pending_activation', 'online'].includes(filter) ? filter : null
  const like = q ? `%${q.replace(/[%_\\]/g, m => '\\' + m).toLowerCase()}%` : null
  return sql`
    SELECT * FROM (
      SELECT v.id, v.visitor_code, v.full_name, v.email, v.company, v.designation, v.status, v.expires_at, v.last_login_at,
        v.total_online_seconds, v.created_at,
        CASE WHEN v.status='disabled' THEN 'disabled'
             WHEN v.expires_at <= now() THEN 'expired'
             ELSE v.status END AS display_status,
        EXISTS (SELECT 1 FROM visitor_sessions_auth s WHERE s.visitor_id=v.id AND s.revoked_at IS NULL AND s.logout_at IS NULL
                AND s.expires_at > now() AND s.last_active_at > ${online()}) AS is_online
      FROM visitors v
      WHERE (${like}::text IS NULL OR lower(v.full_name) LIKE ${like} OR lower(v.email) LIKE ${like} OR lower(v.company) LIKE ${like} OR lower(v.visitor_code) LIKE ${like})
    ) t
    WHERE (${f}::text IS NULL OR (${f} = 'online' AND t.is_online AND t.display_status='active') OR t.display_status = ${f})
    ORDER BY t.created_at DESC LIMIT 300`
}

export async function getVisitorDetail(id: string) {
  const v = (await sql`SELECT id, visitor_code, request_id, full_name, email, mobile, company, designation, purpose, linkedin_url, website_url,
      status, expires_at, activated_at, disabled_at, disabled_reason, last_login_at, total_online_seconds, failed_login_count, locked_until, created_at
    FROM visitors WHERE id = ${id}`)[0]
  if (!v) throw new HttpError(404, 'Visitor not found.')
  const [sessions, audit, emails, chats, req] = await Promise.all([
    sql`SELECT id, login_at, last_active_at, logout_at, expires_at, revoked_at, revoked_reason, online_seconds, device_category, browser, os, ip_address,
          (revoked_at IS NULL AND logout_at IS NULL AND expires_at > now() AND last_active_at > ${online()}) AS is_online
        FROM visitor_sessions_auth WHERE visitor_id=${id} ORDER BY login_at DESC LIMIT 50`,
    sql`SELECT id, event_type, actor_type, ip_address, user_agent, metadata, created_at FROM visitor_audit_logs WHERE visitor_id=${id} ORDER BY created_at DESC LIMIT 200`,
    sql`SELECT id, sender_type, from_address, to_email, notification_type, status, error_message, created_at, sent_at FROM visitor_email_logs WHERE visitor_id=${id} ORDER BY created_at DESC LIMIT 50`,
    sql`SELECT c.id, c.title, c.created_at, c.updated_at, (SELECT COUNT(*) FROM demo_chat_messages m WHERE m.chat_id=c.id)::int AS message_count FROM demo_chats c WHERE c.visitor_id=${id} ORDER BY c.updated_at DESC`,
    v.request_id ? sql`SELECT ip_address, created_at FROM visitor_access_requests WHERE id=${v.request_id}` : Promise.resolve([]),
  ])
  return { visitor: v, sessions, audit, emails, demoChats: chats, requestIp: (req as any[])[0]?.ip_address ?? null, features: await getFeatureAccess(id) }
}

export async function listAllDemoChats() {
  return sql`SELECT c.id, c.title, c.created_at, c.updated_at, c.visitor_id, v.full_name, v.email, v.visitor_code,
      (SELECT COUNT(*) FROM demo_chat_messages m WHERE m.chat_id=c.id)::int AS message_count
    FROM demo_chats c JOIN visitors v ON v.id=c.visitor_id ORDER BY c.updated_at DESC LIMIT 300`
}
export async function adminDemoMessages(chatId: string) {
  return sql`SELECT id, role, content, created_at FROM demo_chat_messages WHERE chat_id=${chatId} ORDER BY created_at ASC LIMIT 1000`
}
export async function listEmailLogs() {
  return sql`SELECT l.id, l.sender_type, l.from_address, l.to_email, l.notification_type, l.status, l.error_message, l.created_at, l.sent_at, v.full_name
    FROM visitor_email_logs l LEFT JOIN visitors v ON v.id=l.visitor_id ORDER BY l.created_at DESC LIMIT 200`
}
