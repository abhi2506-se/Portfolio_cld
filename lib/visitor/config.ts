/** Visitor Management System — central constants. */
export const VISITOR_COOKIE = 'visitor_session'

/** Absolute lifetime of a login session. */
export const SESSION_ABSOLUTE_MS = 12 * 60 * 60 * 1000
/** A session with no heartbeat/API activity for this long is dead. */
export const SESSION_IDLE_MS = 30 * 60 * 1000
/** A visitor counts as "online" if last heartbeat is newer than this. */
export const ONLINE_WINDOW_MS = 2 * 60 * 1000
/** Max seconds credited per heartbeat (stops a stalled tab inflating online time). */
export const HEARTBEAT_MAX_CREDIT_S = 90

export const ACTIVATION_TTL_MS = 72 * 60 * 60 * 1000
export const RESET_TTL_MS = 24 * 60 * 60 * 1000
export const DEFAULT_VALIDITY_DAYS = 30
export const MAX_VALIDITY_DAYS = 365
export const EXPIRY_REMINDER_DAYS = 3
export const IP_RETENTION_DAYS = 90

export const MAX_FAILED_LOGINS = 5
export const LOCKOUT_MS = 15 * 60 * 1000

/**
 * Links in emails are ALWAYS built from this origin — never from the request
 * Host header (prevents host-header poisoning of activation/reset links).
 */
export const SITE_URL = (process.env.VISITOR_SITE_URL || 'https://www.theabhisheksingh.in').replace(/\/+$/, '')

export const APPROVAL_FROM =
  process.env.VISITOR_APPROVAL_FROM || '"Abhishek Singh · Visitor Access" <visitors_approval@theabhisheksingh.in>'
export const NOTIFICATIONS_FROM =
  process.env.VISITOR_NOTIFICATIONS_FROM || '"Abhishek Singh · Visitor Notifications" <visitors_notifications@theabhisheksingh.in>'
