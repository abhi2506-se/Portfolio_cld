# Visitor Management System — setup

## 1. Database (run once, after review)
Preview (touches nothing):
    node scripts/apply-visitor-migration.mjs
Apply (single transaction, additive CREATE ... IF NOT EXISTS only):
    DATABASE_URL=... node scripts/apply-visitor-migration.mjs --apply
Creates 8 tables: visitor_access_requests, visitors, visitor_sessions_auth, visitor_auth_tokens,
visitor_audit_logs, visitor_email_logs, demo_chats, demo_chat_messages.
Existing tables (incl. visitor_sessions analytics, live_chats) are not modified.

## 2. Environment variables (see .env.visitor.example)
SMTP_HOST / SMTP_PORT / SMTP_SECURE / SMTP_USER / SMTP_PASS  (Titan)
CRON_SECRET (required for the maintenance cron)
ANTHROPIC_API_KEY (Demo Chat replies; without it the demo shows a fallback message)
Optional: UPSTASH_REDIS_* (global rate limits), VISITOR_SITE_URL

## 3. Email senders
- visitors_approval@theabhisheksingh.in → approval + activation emails
- visitors_notifications@theabhisheksingh.in → reset, expiry, disable/enable, extension, security alerts
Both must be mailboxes or aliases Titan allows SMTP_USER to send as.
Every send is logged in visitor_email_logs; failures show the Titan error in Admin → Visitor Management → Email Log.

## 4. Maintenance (vercel.json cron, daily 03:00 UTC)
Anonymises IPs older than 90 days, closes idle sessions, revokes sessions of expired accounts,
sends one expiry reminder per expiry date.

## 5. Tests
    npm test   (unit + integration against real Postgres via PGlite, running the real migration SQL)

## Notes
- Public Live Chat pre-chat form requires name, email and mobile before either option.
- Demo Chat from the public pre-chat is stateless and never writes to live_chats.
- Visitor dashboard APIs are read-only except the visitor's own password, sessions and demo chats.
