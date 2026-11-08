import { sql } from './db'
import { newId } from './crypto'

export type AuditEvent =
  | 'request_submitted' | 'account_approved' | 'account_rejected' | 'account_activated' | 'account_created'
  | 'login_success' | 'login_failed' | 'logout' | 'account_disabled' | 'account_enabled'
  | 'password_reset' | 'password_changed' | 'session_revoked' | 'expiry_extended' | 'demo_chat_created'
  | 'activation_resent' | 'account_locked' | 'demo_chat_deleted' | 'feature_access_changed'

export async function logAudit(e: {
  event: AuditEvent; actor: 'visitor' | 'admin' | 'system'; actorId?: string | null
  visitorId?: string | null; requestId?: string | null
  ip?: string | null; ua?: string | null; meta?: Record<string, unknown>
}) {
  try {
    await sql`INSERT INTO visitor_audit_logs (id, visitor_id, request_id, event_type, actor_type, actor_id, ip_address, user_agent, metadata)
      VALUES (${newId()}, ${e.visitorId ?? null}, ${e.requestId ?? null}, ${e.event}, ${e.actor}, ${e.actorId ?? null},
              ${e.ip ?? null}, ${e.ua ?? null}, ${JSON.stringify(e.meta ?? {})}::jsonb)`
  } catch (err) {
    // An audit write must never break the user-facing action, but it must be visible in server logs.
    console.error('[visitor-audit] failed to write', e.event, err)
  }
}
