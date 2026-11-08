'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LayoutDashboard, Bot, UserRound, ShieldCheck, History, LogOut, Loader2, Send, Plus, ExternalLink, Clock, MonitorSmartphone, Lock, Home, User, Code2, Briefcase, GraduationCap, FolderGit2, Award, Eye } from 'lucide-react'
import { postJson } from './shell'

// Visitor console: mirrors the admin panel layout, but it is READ-ONLY and only ever shows
// whitelisted data from the server. Anything about other accounts, admin tools, credentials
// or personal details is shown as "Restricted".

type Feature = 'explorer' | 'demo_chat'
type Item = { id: string; label: string; icon: any; feature?: Feature }

const OWN: Item[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'demo', label: 'Demo Chat', icon: Bot, feature: 'demo_chat' },
  { id: 'account', label: 'Account Details', icon: UserRound },
  { id: 'my_security', label: 'My Security', icon: ShieldCheck },
  { id: 'activity', label: 'Activity History', icon: History },
]
const PORTFOLIO: Item[] = [
  { id: 'hero', label: 'Hero', icon: Home, feature: 'explorer' },
  { id: 'about', label: 'About', icon: User, feature: 'explorer' },
  { id: 'skills', label: 'Skills', icon: Code2, feature: 'explorer' },
  { id: 'experience', label: 'Experience', icon: Briefcase, feature: 'explorer' },
  { id: 'education', label: 'Education', icon: GraduationCap, feature: 'explorer' },
  { id: 'projects', label: 'Projects', icon: FolderGit2, feature: 'explorer' },
  { id: 'certifications', label: 'Certifications', icon: Award, feature: 'explorer' },
]
const RESTRICTED_NAMES = ['Messages', 'Live Chat', 'Chatbot Setup', 'AI Conversations', 'Settings', 'Legal Content', 'Security (admin)', 'GitHub Settings', 'Blog & Articles', 'Testimonials', 'Meetings & Interviews', 'Reminder Status', 'Blocked Users', 'Version & Changelog', 'Sitemap', 'Co-Admins', 'Visitor Management', 'Languages']

// Same visual language as the admin panel (slate surfaces, blue accents, rounded tabs).
const panel = 'bg-slate-900/60 border border-slate-700/40 rounded-xl'
const input = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500 placeholder:text-slate-500'
const primary = 'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold disabled:opacity-50 transition-colors'
const ghost = 'inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:text-white transition-colors'
const fmt = (d?: string | null) => d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }) : '—'
const hasAccess = (me: any, f?: Feature) => !f || !!me?.features?.[f]

function Alert({ kind, children }: { kind: 'error' | 'success' | 'info'; children: React.ReactNode }) {
  const cls = kind === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-300' : kind === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-blue-500/10 border-blue-500/30 text-blue-300'
  return <div role={kind === 'error' ? 'alert' : 'status'} className={`text-sm rounded-lg border px-3.5 py-2.5 ${cls}`}>{children}</div>
}
const Loading = () => <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-400" /></div>

function Locked({ name }: { name: string }) {
  return (
    <div className={`${panel} p-10 text-center space-y-2`}>
      <Lock className="w-8 h-8 text-amber-400 mx-auto" />
      <p className="font-semibold text-white">{name} is locked</p>
      <p className="text-sm text-slate-400 max-w-md mx-auto">Abhishek has not enabled this section for your account yet. It will open here once access is granted.</p>
    </div>
  )
}

function Restricted({ name }: { name: string }) {
  return (
    <div className={`${panel} p-10 text-center space-y-2`}>
      <Lock className="w-8 h-8 text-slate-500 mx-auto" />
      <p className="font-semibold text-white">Restricted</p>
      <p className="text-sm text-slate-400 max-w-md mx-auto">{name} is not available to visitors. It can contain private data about other accounts, credentials or personal details, so it is hidden for safety.</p>
    </div>
  )
}

export function VisitorDashboard() {
  const router = useRouter()
  const [me, setMe] = useState<any>(null)
  const [sel, setSel] = useState<string>('overview')
  const toLogin = useCallback(() => router.replace('/visitor/login'), [router])

  useEffect(() => {
    fetch('/api/visitor/me', { credentials: 'same-origin' }).then(async r => { if (!r.ok) return toLogin(); setMe((await r.json()).visitor) }).catch(toLogin)
  }, [toLogin])

  // Heartbeat every 30s while visible. 401 = revoked / expired / disabled → leave immediately.
  useEffect(() => {
    if (!me) return
    const beat = () => { if (document.visibilityState !== 'visible') return
      fetch('/api/visitor/heartbeat', { method: 'POST', credentials: 'same-origin' }).then(r => { if (r.status === 401) toLogin() }).catch(() => {}) }
    beat(); const t = setInterval(beat, 30000)
    document.addEventListener('visibilitychange', beat)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', beat) }
  }, [me, toLogin])

  const logout = async () => { await postJson('/api/visitor/logout'); toLogin() }
  const onApi = useCallback((status: number) => { if (status === 401) toLogin() }, [toLogin])

  if (!me) return <div className="min-h-[60vh] bg-slate-950 flex items-center justify-center"><Loader2 className="w-7 h-7 animate-spin text-blue-400" /></div>

  const item = [...OWN, ...PORTFOLIO].find(i => i.id === sel)
  const navBtn = (i: Item) => {
    const I = i.icon; const active = sel === i.id; const locked = !hasAccess(me, i.feature)
    return (
      <button key={i.id} onClick={() => setSel(i.id)} aria-current={active}
        className={`flex items-center gap-2.5 whitespace-nowrap px-3 py-2 rounded-lg text-sm transition-colors ${active ? 'bg-blue-600/20 text-blue-400 border border-blue-500/20' : 'text-slate-300 hover:bg-slate-800/60 border border-transparent'}`}>
        <I className="w-4 h-4 shrink-0" /><span className="truncate">{i.label}</span>{locked && <Lock className="w-3 h-3 text-amber-400 ml-auto shrink-0" aria-label="locked" />}
      </button>
    )
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-950 text-slate-100">
      <div className="max-w-7xl mx-auto px-3 md:px-6 py-5 grid md:grid-cols-[250px_1fr] gap-5">
        <aside className="md:sticky md:top-20 md:self-start min-w-0">
          <div className={`${panel} p-3 space-y-4`}>
            <div className="px-2">
              <p className="text-xs text-slate-400">Signed in as</p>
              <p className="text-sm font-semibold text-white truncate">{me.fullName}</p>
              <p className="text-[11px] font-mono text-slate-500">{me.visitorCode}</p>
            </div>
            <nav aria-label="Visitor console" className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-1 md:pb-0">
              <div className="contents md:block"><p className="hidden md:block px-3 pb-1 text-[10px] uppercase tracking-wider text-slate-500">My account</p>{OWN.map(navBtn)}</div>
              <div className="contents md:block md:pt-2"><p className="hidden md:block px-3 pb-1 text-[10px] uppercase tracking-wider text-slate-500">Portfolio · read-only</p>{PORTFOLIO.map(navBtn)}</div>
              <div className="contents md:block md:pt-2">
                <p className="hidden md:block px-3 pb-1 text-[10px] uppercase tracking-wider text-slate-500">Admin tools</p>
                {RESTRICTED_NAMES.map(n => <button key={n} onClick={() => setSel('restricted:' + n)} className={`flex items-center gap-2.5 whitespace-nowrap px-3 py-2 rounded-lg text-sm ${sel === 'restricted:' + n ? 'bg-slate-800 text-slate-200' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/40'}`}><Lock className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{n}</span></button>)}
              </div>
            </nav>
            <button onClick={logout} className={`${ghost} w-full justify-center`}><LogOut className="w-3.5 h-3.5" /> Sign out</button>
          </div>
        </aside>

        <main className="min-w-0 space-y-4">
          <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900/40 border border-slate-700/40 rounded-lg px-3 py-2">
            <Eye className="w-3.5 h-3.5 text-blue-400" /> Read-only visitor view. Nothing you do here changes the live portfolio or any admin data.
          </div>
          {sel.startsWith('restricted:') && <Restricted name={sel.slice('restricted:'.length)} />}
          {!sel.startsWith('restricted:') && item && !hasAccess(me, item.feature) && <Locked name={item.label} />}
          {!sel.startsWith('restricted:') && item && hasAccess(me, item.feature) && (
            <>
              {sel === 'overview' && <Overview me={me} setSel={setSel} />}
              {sel === 'demo' && <DemoChat onApi={onApi} />}
              {sel === 'account' && <Account me={me} />}
              {sel === 'my_security' && <Security onApi={onApi} />}
              {sel === 'activity' && <Activity onApi={onApi} />}
              {PORTFOLIO.some(p => p.id === sel) && <Portfolio id={sel} onApi={onApi} />}
            </>
          )}
        </main>
      </div>
    </div>
  )
}

function Overview({ me, setSel }: { me: any; setSel: (s: string) => void }) {
  const days = Math.max(0, Math.ceil((new Date(me.expiresAt).getTime() - Date.now()) / 86400000))
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-4">
        <div className={`${panel} p-4`}><p className="text-xs text-slate-400">Visitor ID</p><p className="text-lg font-bold mt-1 font-mono text-white">{me.visitorCode}</p></div>
        <div className={`${panel} p-4`}><p className="text-xs text-slate-400">Access valid for</p><p className="text-lg font-bold mt-1 text-white">{days} day{days === 1 ? '' : 's'}</p><p className="text-[11px] text-slate-500">until {fmt(me.expiresAt)}</p></div>
        <div className={`${panel} p-4`}><p className="text-xs text-slate-400">Last sign-in</p><p className="text-sm font-semibold mt-1 text-white">{fmt(me.lastLoginAt)}</p></div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {[{ id: 'hero', t: 'Portfolio', d: 'Browse hero, about, skills, experience, education, projects and certifications.', f: 'explorer' as Feature }, { id: 'demo', t: 'Demo Chat', d: 'Chat with the AI assistant. Private to your account.', f: 'demo_chat' as Feature }].map(c => {
          const open = hasAccess(me, c.f)
          return (
            <button key={c.id} onClick={() => setSel(c.id)} className={`${panel} p-5 text-left transition-colors ${open ? 'hover:border-blue-500/40' : 'opacity-70 hover:opacity-100'}`}>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white">{c.t}</span>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${open ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>{open ? 'Enabled' : 'Locked'}</span>
              </div>
              <p className="text-sm text-slate-400 mt-1">{open ? c.d : 'Waiting for admin to enable this section.'}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function useApi<T>(url: string, onApi: (s: number) => void) {
  const [data, setData] = useState<T | null>(null); const [err, setErr] = useState('')
  useEffect(() => { let on = true
    fetch(url, { credentials: 'same-origin' }).then(async r => { onApi(r.status); const d = await r.json().catch(() => ({})); if (!on) return; r.ok ? setData(d) : setErr(d.error || 'Failed to load') }).catch(() => on && setErr('Failed to load'))
    return () => { on = false } }, [url, onApi])
  return { data, err }
}

/** Read-only portfolio views, fed only by the whitelisted /api/visitor/explorer endpoint. */
function Portfolio({ id, onApi }: { id: string; onApi: (s: number) => void }) {
  const { data, err } = useApi<any>('/api/visitor/explorer', onApi)
  if (err) return <Alert kind="error">{err}</Alert>
  if (!data) return <Loading />
  const card = `${panel} p-5`
  if (id === 'hero') return <div className={card}><p className="text-lg font-bold text-white">{data.hero.name}</p><p className="text-sm text-blue-400">{data.hero.title}</p><p className="text-sm text-slate-400 mt-2">{data.hero.description}</p>{data.hero.location && <p className="text-xs text-slate-500 mt-2">{data.hero.location}</p>}</div>
  if (id === 'about') return <div className={`${card} space-y-3 text-sm text-slate-300`}>{[data.about.bio1, data.about.bio2, data.about.bio3].filter(Boolean).map((b: string, i: number) => <p key={i}>{b}</p>)}</div>
  if (id === 'skills') return <div className="grid sm:grid-cols-2 gap-4">{data.skills.map((s: any, i: number) => <div key={i} className={card}><p className="font-semibold text-white">{s.title}</p><div className="flex flex-wrap gap-1.5 mt-2">{(s.skills || []).map((k: string) => <span key={k} className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">{k}</span>)}</div></div>)}</div>
  if (id === 'experience') return <div className="space-y-3">{data.experience.map((e: any, i: number) => <div key={i} className={card}><p className="font-semibold text-white">{e.title}</p><p className="text-sm text-slate-400">{e.company} {e.period || e.duration ? `· ${e.period || e.duration}` : ''}</p>{e.description && <p className="text-sm text-slate-300 mt-2">{e.description}</p>}</div>)}</div>
  if (id === 'education') return <div className="space-y-3">{data.education.map((e: any, i: number) => <div key={i} className={card}><p className="font-semibold text-white">{e.degree}</p><p className="text-sm text-slate-400">{e.institution || e.school} {e.period || e.duration ? `· ${e.period || e.duration}` : ''}</p></div>)}</div>
  if (id === 'certifications') return data.certifications.length ? <div className="space-y-3">{data.certifications.map((c: any, i: number) => <div key={i} className={card}><p className="font-semibold text-white">{c.name}</p><p className="text-sm text-slate-400">{c.issuer} {c.date ? `· ${c.date}` : ''}</p></div>)}</div> : <p className="text-sm text-slate-400">No certifications published yet.</p>
  // projects
  return <div className="grid sm:grid-cols-2 gap-4">{data.projects.map((p: any, i: number) => (
    <div key={i} className={card}><p className="font-semibold text-white">{p.title}</p><p className="text-sm text-slate-400 mt-1 line-clamp-4">{p.description}</p>
      <div className="flex flex-wrap gap-1.5 mt-3">{(p.technologies || p.tech || []).slice(0, 8).map((t: string) => <span key={t} className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">{t}</span>)}</div>
      {p.slug && <a href={`/projects/${p.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-400 mt-3 hover:underline">Open project <ExternalLink className="w-3 h-3" /></a>}</div>))}</div>
}

function DemoChat({ onApi }: { onApi: (s: number) => void }) {
  const [chats, setChats] = useState<any[]>([]); const [active, setActive] = useState<string | null>(null)
  const [msgs, setMsgs] = useState<any[]>([]); const [input, setInput] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  const end = useRef<HTMLDivElement>(null)
  const loadChats = useCallback(async () => { const r = await fetch('/api/visitor/demo-chat', { credentials: 'same-origin' }); onApi(r.status); if (r.ok) setChats((await r.json()).chats) }, [onApi])
  useEffect(() => { loadChats() }, [loadChats])
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, busy])
  const open = async (id: string) => { setActive(id); setErr(''); const r = await fetch(`/api/visitor/demo-chat/${id}`, { credentials: 'same-origin' }); onApi(r.status); if (r.ok) setMsgs((await r.json()).messages) }
  // A new chat is created ONLY when the visitor clicks "New chat".
  const create = async () => { const r = await postJson('/api/visitor/demo-chat'); onApi(r.status); if (r.ok) { await loadChats(); setMsgs([]); setActive(r.data.id) } else setErr(r.data.error || 'Could not create chat') }
  const send = async () => {
    const text = input.trim(); if (!text || !active || busy) return
    setBusy(true); setErr(''); setInput(''); setMsgs(m => [...m, { id: 'tmp', role: 'user', content: text }])
    const r = await postJson(`/api/visitor/demo-chat/${active}`, { content: text }); onApi(r.status); setBusy(false)
    if (r.ok) { setMsgs(m => [...m, r.data.message]); loadChats() } else setErr(r.data.error || 'Could not send')
  }
  return (
    <div className="grid md:grid-cols-[240px_1fr] gap-4">
      <div className={`${panel} p-3 space-y-1 max-h-[60vh] overflow-y-auto`}>
        <button onClick={create} className={`${primary} w-full mb-2`}><Plus className="w-4 h-4" /> New chat</button>
        {chats.map(c => <button key={c.id} onClick={() => open(c.id)} className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate ${active === c.id ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800/60'}`}>{c.title}</button>)}
        {!chats.length && <p className="text-xs text-slate-500 px-2 py-3">No chats yet.</p>}
      </div>
      <div className={`${panel} flex flex-col h-[60vh]`}>
        {!active ? <div className="m-auto text-sm text-slate-400 text-center px-6">Start a new demo chat to try the AI assistant.<br /><span className="text-xs text-slate-500">Demo only — separate from Abhishek's live chat.</span></div> : (<>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {msgs.map((m, i) => <div key={m.id + i} className={`flex ${m.role === 'user' ? 'justify-end' : ''}`}><div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-200'}`}>{m.content}</div></div>)}
            {busy && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
            <div ref={end} />
          </div>
          {err && <div className="px-4 pb-2"><Alert kind="error">{err}</Alert></div>}
          <div className="p-3 border-t border-slate-700/40 flex gap-2"><input className={input} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} maxLength={1000} placeholder="Type a message…" />
            <button onClick={send} disabled={!input.trim() || busy} aria-label="Send" className={`${primary} px-3.5`}><Send className="w-4 h-4" /></button></div></>)}
      </div>
    </div>
  )
}

function Account({ me }: { me: any }) {
  const rows: [string, string][] = [['Visitor ID', me.visitorCode], ['Full name', me.fullName], ['Email', me.email], ['Mobile', me.mobile], ['Company', me.company], ['Designation', me.designation], ['Purpose', me.purpose], ['LinkedIn', me.linkedinUrl || '—'], ['Website', me.websiteUrl || '—'], ['Activated', fmt(me.activatedAt)], ['Access expires', fmt(me.expiresAt)]]
  return (
    <div className={`${panel} divide-y divide-slate-700/40`}>
      {rows.map(([k, v]) => <div key={k} className="py-2.5 px-5 grid sm:grid-cols-[160px_1fr] gap-1 text-sm"><span className="text-slate-400">{k}</span><span className="break-words text-slate-100">{v}</span></div>)}
      <p className="px-5 py-3 text-xs text-slate-500">To change profile details, contact Abhishek.</p>
    </div>
  )
}

function Security({ onApi }: { onApi: (s: number) => void }) {
  const [cur, setCur] = useState(''); const [nw, setNw] = useState(''); const [msg, setMsg] = useState<{ k: 'error' | 'success'; t: string } | null>(null); const [busy, setBusy] = useState(false)
  const { data } = useApi<any>('/api/visitor/sessions', onApi)
  const change = async (e: React.FormEvent) => { e.preventDefault(); setBusy(true); setMsg(null)
    const r = await postJson('/api/visitor/password', { currentPassword: cur, newPassword: nw }); onApi(r.status); setBusy(false)
    if (r.ok) { setMsg({ k: 'success', t: 'Password changed. Other devices were signed out.' }); setCur(''); setNw('') } else setMsg({ k: 'error', t: r.data.error || 'Failed' }) }
  const others = async () => { const r = await postJson('/api/visitor/sessions'); setMsg(r.ok ? { k: 'success', t: `Signed out ${r.data.revoked} other session(s).` } : { k: 'error', t: r.data.error || 'Failed' }) }
  return (
    <div className="space-y-4">
      <form onSubmit={change} className={`${panel} p-5 space-y-3 max-w-md`}>
        <p className="font-semibold text-white">Change password</p>
        <input type="password" className={input} placeholder="Current password" value={cur} onChange={e => setCur(e.target.value)} required autoComplete="current-password" />
        <input type="password" className={input} placeholder="New password (10+ chars, Aa1)" value={nw} onChange={e => setNw(e.target.value)} required minLength={10} autoComplete="new-password" />
        {msg && <Alert kind={msg.k}>{msg.t}</Alert>}
        <button className={primary} disabled={busy}>{busy ? 'Saving…' : 'Update password'}</button>
      </form>
      <div className={`${panel} p-5`}>
        <div className="flex items-center justify-between mb-3"><p className="font-semibold text-white">Recent sessions</p><button onClick={others} className="text-xs text-red-400 hover:underline">Sign out other devices</button></div>
        {!data ? <Loading /> : <ul className="space-y-2">{data.sessions.map((s: any) => <li key={s.id} className="flex items-center gap-3 text-sm"><MonitorSmartphone className="w-4 h-4 text-slate-500 shrink-0" /><span className="min-w-0 flex-1 truncate text-slate-200">{s.browser} · {s.os} · {s.device_category}{s.current && <b className="ml-2 text-emerald-400 text-xs">this device</b>}</span><span className="text-xs text-slate-500 whitespace-nowrap">{fmt(s.login_at)}</span></li>)}</ul>}
      </div>
    </div>
  )
}

const LABELS: Record<string, string> = { request_submitted: 'Access requested', account_approved: 'Account approved', account_activated: 'Account activated', account_created: 'Account created', login_success: 'Signed in', login_failed: 'Failed sign-in attempt', logout: 'Signed out', account_disabled: 'Account disabled', account_enabled: 'Account enabled', password_reset: 'Password reset by admin', password_changed: 'Password changed', session_revoked: 'Sessions signed out', expiry_extended: 'Access extended', demo_chat_created: 'Demo chat created', activation_resent: 'Activation link re-sent', account_locked: 'Account temporarily locked', feature_access_changed: 'Section access updated' }
function Activity({ onApi }: { onApi: (s: number) => void }) {
  const { data, err } = useApi<any>('/api/visitor/activity', onApi)
  if (err) return <Alert kind="error">{err}</Alert>
  if (!data) return <Loading />
  return (
    <div className={`${panel} divide-y divide-slate-700/40`}>
      {data.events.length ? data.events.map((e: any) => <div key={e.id} className="py-2.5 px-5 flex items-center justify-between gap-3 text-sm"><span className="flex items-center gap-2 text-slate-200"><Clock className="w-3.5 h-3.5 text-slate-500" />{LABELS[e.event_type] || e.event_type}</span><span className="text-xs text-slate-500 whitespace-nowrap">{fmt(e.created_at)}</span></div>) : <p className="px-5 py-4 text-sm text-slate-400">No activity yet.</p>}
    </div>
  )
}
