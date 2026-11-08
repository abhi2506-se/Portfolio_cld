'use client'
import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw, X, Check, Ban, KeyRound, CalendarPlus, LogOut, Send, Plus, Mail, Bot, Users, Trash2 } from 'lucide-react'

type View = 'overview' | 'requests' | 'visitors' | 'chats' | 'emails'
const panel = 'bg-slate-900/60 border border-slate-700/40 rounded-xl'
const inp = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500'
const btn = 'inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50'
const fmt = (d?: string | null) => d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }) : '—'
const dur = (s: number) => { s = Math.max(0, Math.round(Number(s) || 0)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h ? `${h}h ${m}m` : `${m}m ${s % 60}s` }

async function api(url: string, method = 'GET', body?: unknown) {
  const res = await fetch(url, { method, credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
}

const STATUS_CLS: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-400', pending: 'bg-amber-500/15 text-amber-400', pending_activation: 'bg-amber-500/15 text-amber-400',
  approved: 'bg-emerald-500/15 text-emerald-400', rejected: 'bg-red-500/15 text-red-400', disabled: 'bg-red-500/15 text-red-400',
  expired: 'bg-slate-500/20 text-slate-300', sent: 'bg-emerald-500/15 text-emerald-400', failed: 'bg-red-500/15 text-red-400', queued: 'bg-amber-500/15 text-amber-400',
}
const Pill = ({ s }: { s: string }) => <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_CLS[s] || 'bg-slate-500/20 text-slate-300'}`}>{s.replace('_', ' ')}</span>

export function VisitorManagement() {
  const [view, setView] = useState<View>('overview')
  const [toast, setToast] = useState<{ ok: boolean; t: string } | null>(null)
  const note = useCallback((ok: boolean, t: string) => { setToast({ ok, t }); setTimeout(() => setToast(null), 6000) }, [])
  const tabs: [View, string][] = [['overview', 'Overview'], ['requests', 'Requests'], ['visitors', 'Visitors'], ['chats', 'Demo Chats'], ['emails', 'Email Log']]
  return (
    <div className="space-y-5">
      <div><h2 className="text-xl font-bold text-white">Visitor Management</h2><p className="text-sm text-slate-400">Approve access requests, manage visitor accounts, sessions and demo chats.</p></div>
      <div className="flex gap-1.5 bg-slate-900/40 p-1 rounded-xl border border-slate-700/40 flex-wrap">
        {tabs.map(([id, l]) => <button key={id} onClick={() => setView(id)} className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold ${view === id ? 'bg-blue-600/20 text-blue-400 border border-blue-500/20' : 'text-slate-400 hover:text-white'}`}>{l}</button>)}
      </div>
      {toast && <div className={`text-sm rounded-lg px-3 py-2 border ${toast.ok ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-red-500/10 border-red-500/30 text-red-300'}`}>{toast.t}</div>}
      {view === 'overview' && <Overview />}
      {view === 'requests' && <Requests note={note} />}
      {view === 'visitors' && <Visitors note={note} />}
      {view === 'chats' && <Chats note={note} />}
      {view === 'emails' && <Emails />}
    </div>
  )
}

function useLoad<T>(url: string) {
  const [data, setData] = useState<T | null>(null); const [err, setErr] = useState(''); const [loading, setLoading] = useState(true)
  const load = useCallback(async () => { setLoading(true); setErr(''); try { setData(await api(url)) } catch (e: any) { setErr(e.message) } setLoading(false) }, [url])
  useEffect(() => { load() }, [load])
  return { data, err, loading, reload: load }
}
const Loader = () => <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-blue-400 animate-spin" /></div>
const ErrBox = ({ e }: { e: string }) => <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg p-3">{e}</div>

function Overview() {
  const { data, err, loading, reload } = useLoad<any>('/api/admin/visitors/stats')
  if (loading) return <Loader />; if (err) return <ErrBox e={err} />
  const s = data.stats
  const items: [string, number, string][] = [['Total Visitors', s.total_visitors, 'text-blue-400'], ['Pending Requests', s.pending_requests, 'text-amber-400'], ['Approved Visitors', s.approved_visitors, 'text-emerald-400'], ['Rejected Requests', s.rejected_requests, 'text-red-400'], ['Active Accounts', s.active_accounts, 'text-emerald-400'], ['Disabled Accounts', s.disabled_accounts, 'text-red-400'], ['Expired Accounts', s.expired_accounts, 'text-slate-300'], ['Currently Online', s.online_visitors, 'text-cyan-400'], ['Total Demo Chats', s.total_demo_chats, 'text-violet-400']]
  return (<div className="space-y-4">
    {!data.smtpConfigured && <ErrBox e="SMTP_USER / SMTP_PASS are not set — approval and notification emails cannot be sent." />}
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{items.map(([l, v, c]) => <div key={l} className={`${panel} p-4`}><p className="text-xs text-slate-400">{l}</p><p className={`text-2xl font-bold ${c}`}>{v}</p></div>)}</div>
    <button onClick={reload} className={`${btn} border-slate-700 text-slate-300 hover:text-white`}><RefreshCw className="w-3.5 h-3.5" /> Refresh</button></div>)
}

function Requests({ note }: { note: (ok: boolean, t: string) => void }) {
  const [status, setStatus] = useState('pending')
  const { data, err, loading, reload } = useLoad<any>(`/api/admin/visitors/requests?status=${status}`)
  const [busy, setBusy] = useState(''); const [days, setDays] = useState<Record<string, number>>({})
  const act = async (id: string, action: 'approve' | 'reject') => {
    let reason: string | undefined
    if (action === 'reject') { const r = window.prompt('Reason (optional, internal):'); if (r === null) return; reason = r }
    else if (!window.confirm('Approve this request and email an activation link?')) return
    setBusy(id)
    try { const r = await api(`/api/admin/visitors/requests/${id}`, 'POST', { action, reason, validityDays: days[id] || 30 })
      note(true, action === 'approve' ? `Approved (${r.visitorCode}). ${r.emailSent ? 'Activation email sent.' : `Email NOT sent: ${r.emailError}`}` : 'Request rejected.') ; reload()
    } catch (e: any) { note(false, e.message) }
    setBusy('')
  }
  return (<div className="space-y-3">
    <div className="flex gap-2 items-center flex-wrap">{['pending', 'approved', 'rejected', ''].map(s => <button key={s || 'all'} onClick={() => setStatus(s)} className={`${btn} ${status === s ? 'border-blue-500/40 text-blue-400 bg-blue-500/10' : 'border-slate-700 text-slate-400'}`}>{s || 'all'}</button>)}
      <button onClick={reload} className={`${btn} border-slate-700 text-slate-300 ml-auto`}><RefreshCw className="w-3.5 h-3.5" /></button></div>
    {loading ? <Loader /> : err ? <ErrBox e={err} /> : !data.requests.length ? <p className="text-sm text-slate-400 py-8 text-center">No requests.</p> :
      data.requests.map((r: any) => (<div key={r.id} className={`${panel} p-4 space-y-2`}>
        <div className="flex items-start justify-between gap-3 flex-wrap"><div><p className="font-semibold text-white">{r.full_name} <span className="text-slate-400 font-normal">· {r.designation}, {r.company}</span></p>
          <p className="text-xs text-slate-400">{r.email} · {r.mobile} · {fmt(r.created_at)}{r.ip_address ? ` · IP ${r.ip_address}` : ''}</p></div><Pill s={r.status} /></div>
        <p className="text-sm text-slate-300 whitespace-pre-wrap">{r.purpose}</p>
        <div className="flex gap-3 text-xs">{r.linkedin_url && <a className="text-blue-400 hover:underline" href={r.linkedin_url} target="_blank" rel="noopener noreferrer">LinkedIn</a>}{r.website_url && <a className="text-blue-400 hover:underline" href={r.website_url} target="_blank" rel="noopener noreferrer">Website</a>}</div>
        {r.status === 'rejected' && r.reject_reason && <p className="text-xs text-red-300">Reason: {r.reject_reason}</p>}
        {r.status === 'pending' && <div className="flex items-center gap-2 flex-wrap pt-1">
          <label className="text-xs text-slate-400 flex items-center gap-1.5">Valid for <input type="number" min={1} max={365} value={days[r.id] ?? 30} onChange={e => setDays(d => ({ ...d, [r.id]: Number(e.target.value) }))} className="w-16 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white" /> days</label>
          <button disabled={busy === r.id} onClick={() => act(r.id, 'approve')} className={`${btn} border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10`}><Check className="w-3.5 h-3.5" /> Approve</button>
          <button disabled={busy === r.id} onClick={() => act(r.id, 'reject')} className={`${btn} border-red-500/40 text-red-400 hover:bg-red-500/10`}><X className="w-3.5 h-3.5" /> Reject</button></div>}
      </div>))}</div>)
}

function Visitors({ note }: { note: (ok: boolean, t: string) => void }) {
  const [filter, setFilter] = useState(''); const [q, setQ] = useState(''); const [qq, setQq] = useState('')
  const { data, err, loading, reload } = useLoad<any>(`/api/admin/visitors?filter=${filter}&q=${encodeURIComponent(qq)}`)
  const [sel, setSel] = useState<string | null>(null); const [creating, setCreating] = useState(false)
  return (<div className="space-y-3">
    <div className="flex gap-2 flex-wrap items-center">
      {['', 'active', 'online', 'pending_activation', 'disabled', 'expired'].map(s => <button key={s || 'all'} onClick={() => setFilter(s)} className={`${btn} ${filter === s ? 'border-blue-500/40 text-blue-400 bg-blue-500/10' : 'border-slate-700 text-slate-400'}`}>{(s || 'all').replace('_', ' ')}</button>)}
      <form onSubmit={e => { e.preventDefault(); setQq(q) }} className="flex gap-1.5 ml-auto"><input className={`${inp} !w-44 !py-1.5`} placeholder="Search…" value={q} onChange={e => setQ(e.target.value)} /></form>
      <button onClick={() => setCreating(true)} className={`${btn} border-blue-500/40 text-blue-400`}><Plus className="w-3.5 h-3.5" /> Create account</button></div>
    {loading ? <Loader /> : err ? <ErrBox e={err} /> : !data.visitors.length ? <p className="text-sm text-slate-400 py-8 text-center">No visitors.</p> :
      <div className={`${panel} overflow-x-auto`}><table className="w-full text-sm"><thead><tr className="text-left text-xs text-slate-400 border-b border-slate-700/40"><th className="p-3">Visitor</th><th className="p-3">Status</th><th className="p-3">Expires</th><th className="p-3">Last login</th><th className="p-3">Online time</th></tr></thead>
        <tbody>{data.visitors.map((v: any) => <tr key={v.id} onClick={() => setSel(v.id)} className="border-b border-slate-800 hover:bg-slate-800/50 cursor-pointer">
          <td className="p-3"><p className="text-white font-medium">{v.full_name} {v.is_online && v.display_status === 'active' && <span className="ml-1 text-[10px] text-cyan-400">● online</span>}</p><p className="text-xs text-slate-400">{v.visitor_code} · {v.email}</p></td>
          <td className="p-3"><Pill s={v.display_status} /></td><td className="p-3 text-slate-300 whitespace-nowrap">{fmt(v.expires_at)}</td><td className="p-3 text-slate-300 whitespace-nowrap">{fmt(v.last_login_at)}</td><td className="p-3 text-slate-300">{dur(v.total_online_seconds)}</td></tr>)}</tbody></table></div>}
    {sel && <Detail id={sel} onClose={() => { setSel(null); reload() }} note={note} />}
    {creating && <CreateModal onClose={() => { setCreating(false); reload() }} note={note} />}
  </div>)
}

function CreateModal({ onClose, note }: { onClose: () => void; note: (ok: boolean, t: string) => void }) {
  const [f, setF] = useState<any>({ fullName: '', email: '', mobile: '', company: '', designation: '', purpose: 'Created by admin', validityDays: 30 }); const [busy, setBusy] = useState(false)
  const set = (k: string) => (e: any) => setF((p: any) => ({ ...p, [k]: e.target.value }))
  const submit = async (e: React.FormEvent) => { e.preventDefault(); setBusy(true)
    try { const r = await api('/api/admin/visitors', 'POST', { ...f, validityDays: Number(f.validityDays) }); note(true, `Created ${r.visitorCode}. ${r.emailSent ? 'Activation email sent.' : `Email NOT sent: ${r.emailError}`}`); onClose() } catch (er: any) { note(false, er.message); setBusy(false) } }
  return (<Modal title="Create visitor account" onClose={onClose}><form onSubmit={submit} className="space-y-2.5">
    {[['fullName', 'Full name'], ['email', 'Email'], ['mobile', 'Mobile'], ['company', 'Company'], ['designation', 'Designation'], ['purpose', 'Purpose']].map(([k, l]) => <input key={k} required className={inp} placeholder={l} value={f[k]} onChange={set(k)} />)}
    <label className="text-xs text-slate-400 flex items-center gap-2">Valid for <input type="number" min={1} max={365} className={`${inp} !w-20`} value={f.validityDays} onChange={set('validityDays')} /> days</label>
    <button disabled={busy} className={`${btn} w-full justify-center border-blue-500/40 text-blue-300 bg-blue-500/10 py-2`}>{busy ? 'Creating…' : 'Create & send activation email'}</button></form></Modal>)
}

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
    <div className={`bg-slate-900 border border-slate-700 rounded-2xl p-5 w-full ${wide ? 'max-w-4xl' : 'max-w-md'} max-h-[88vh] overflow-y-auto`} onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-bold text-white">{title}</h3><button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button></div>{children}</div></div>)
}

function Detail({ id, onClose, note }: { id: string; onClose: () => void; note: (ok: boolean, t: string) => void }) {
  const { data, err, loading, reload } = useLoad<any>(`/api/admin/visitors/${id}`)
  const [sub, setSub] = useState<'profile' | 'sessions' | 'audit' | 'chats' | 'emails'>('profile'); const [busy, setBusy] = useState(false)
  const [chat, setChat] = useState<{ id: string; title: string; msgs: any[] } | null>(null)
  const run = async (action: string, extra: Record<string, unknown> = {}, confirmMsg?: string) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return
    setBusy(true)
    try { const r = await api(`/api/admin/visitors/${id}`, 'POST', { action, ...extra })
      note(true, `Done.${r.emailSent === false ? ` Email NOT sent: ${r.emailError || 'n/a'}` : r.emailSent ? ' Email sent.' : ''}${r.revoked != null ? ` ${r.revoked} session(s) revoked.` : ''}`); reload()
    } catch (e: any) { note(false, e.message) }
    setBusy(false)
  }
  const openChat = async (c: any) => { try { const r = await api(`/api/admin/visitors/demo-chats?chatId=${c.id}`); setChat({ id: c.id, title: c.title, msgs: r.messages }) } catch (e: any) { note(false, e.message) } }
  const v = data?.visitor
  const status = v ? (v.status === 'disabled' ? 'disabled' : new Date(v.expires_at) <= new Date() ? 'expired' : v.status) : ''
  return (<Modal title="Visitor profile" onClose={onClose} wide>
    {loading ? <Loader /> : err ? <ErrBox e={err} /> : (<div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap"><p className="text-white font-semibold text-lg">{v.full_name}</p><Pill s={status} /><span className="text-xs text-slate-400 font-mono">{v.visitor_code}</span></div>
      <div className="flex gap-2 flex-wrap">
        {v.status === 'disabled'
          ? <button disabled={busy} onClick={() => run('enable')} className={`${btn} border-emerald-500/40 text-emerald-400`}><Check className="w-3.5 h-3.5" /> Enable</button>
          : <button disabled={busy} onClick={() => { const r = window.prompt('Reason for disabling (optional):'); if (r !== null) run('disable', { reason: r }) }} className={`${btn} border-red-500/40 text-red-400`}><Ban className="w-3.5 h-3.5" /> Disable</button>}
        <button disabled={busy} onClick={() => run('reset_password', {}, 'Send a password-reset link and sign the visitor out everywhere?')} className={`${btn} border-slate-600 text-slate-200`}><KeyRound className="w-3.5 h-3.5" /> Reset password</button>
        <button disabled={busy} onClick={() => { const d = window.prompt('Extend by how many days? (or enter a date YYYY-MM-DD)', '30'); if (!d) return; /^\d{4}-\d{2}-\d{2}$/.test(d) ? run('extend', { date: d }) : run('extend', { days: Number(d) }) }} className={`${btn} border-slate-600 text-slate-200`}><CalendarPlus className="w-3.5 h-3.5" /> Change expiry</button>
        <button disabled={busy} onClick={() => run('revoke_sessions', {}, 'Immediately sign this visitor out of all sessions?')} className={`${btn} border-slate-600 text-slate-200`}><LogOut className="w-3.5 h-3.5" /> Revoke sessions</button>
        {v.status === 'pending_activation' && <button disabled={busy} onClick={() => run('resend_activation')} className={`${btn} border-blue-500/40 text-blue-400`}><Send className="w-3.5 h-3.5" /> Resend activation</button>}
      </div>
      <div className="flex gap-2 flex-wrap items-center text-xs text-slate-400"><span>Dashboard sections (locked until enabled):</span>
        {(['explorer', 'demo_chat'] as const).map(f => <button key={f} disabled={busy} onClick={() => run('set_feature', { feature: f, granted: !data.features[f] })} className={`${btn} ${data.features[f] ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10' : 'border-slate-600 text-slate-400'}`}>{data.features[f] ? 'Enabled' : 'Locked'} · {f === 'explorer' ? 'Portfolio Explorer' : 'Demo Chat'}</button>)}
      </div>
      <div className="flex gap-1.5 flex-wrap">{(['profile', 'sessions', 'audit', 'chats', 'emails'] as const).map(t => <button key={t} onClick={() => setSub(t)} className={`${btn} capitalize ${sub === t ? 'border-blue-500/40 text-blue-400 bg-blue-500/10' : 'border-slate-700 text-slate-400'}`}>{t === 'audit' ? 'Audit log' : t === 'chats' ? `Demo chats (${data.demoChats.length})` : t}</button>)}</div>
      {sub === 'profile' && <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">{([['Email', v.email], ['Mobile', v.mobile], ['Company', v.company], ['Designation', v.designation], ['Purpose', v.purpose], ['LinkedIn', v.linkedin_url || '—'], ['Website', v.website_url || '—'], ['Account created', fmt(v.created_at)], ['Activated', fmt(v.activated_at)], ['Expires', fmt(v.expires_at)], ['Last login', fmt(v.last_login_at)], ['Total online time', dur(v.total_online_seconds)], ['Request IP', data.requestIp || '— (anonymised or n/a)'], ['Disabled reason', v.disabled_reason || '—'], ['Failed logins', String(v.failed_login_count)]] as [string, string][]).map(([k, x]) => <div key={k}><p className="text-xs text-slate-500">{k}</p><p className="text-slate-200 break-words">{x}</p></div>)}</div>}
      {sub === 'sessions' && <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="text-left text-slate-400"><th className="p-2">Login</th><th className="p-2">Last active</th><th className="p-2">Logout / revoked</th><th className="p-2">Online</th><th className="p-2">Device</th><th className="p-2">IP</th></tr></thead><tbody>{data.sessions.map((s: any) => <tr key={s.id} className="border-t border-slate-800 text-slate-300"><td className="p-2 whitespace-nowrap">{fmt(s.login_at)}{s.is_online && <b className="text-cyan-400 ml-1">● live</b>}</td><td className="p-2 whitespace-nowrap">{fmt(s.last_active_at)}</td><td className="p-2 whitespace-nowrap">{s.revoked_at ? `revoked (${s.revoked_reason})` : fmt(s.logout_at)}</td><td className="p-2">{dur(s.online_seconds)}</td><td className="p-2">{s.device_category} · {s.browser} · {s.os}</td><td className="p-2 font-mono">{s.ip_address || '—'}</td></tr>)}</tbody></table>{!data.sessions.length && <p className="text-sm text-slate-400 p-3">No sessions yet.</p>}</div>}
      {sub === 'audit' && <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="text-left text-slate-400"><th className="p-2">Time</th><th className="p-2">Event</th><th className="p-2">By</th><th className="p-2">IP</th><th className="p-2">Details</th></tr></thead><tbody>{data.audit.map((a: any) => <tr key={a.id} className="border-t border-slate-800 text-slate-300"><td className="p-2 whitespace-nowrap">{fmt(a.created_at)}</td><td className="p-2">{a.event_type}</td><td className="p-2">{a.actor_type}</td><td className="p-2 font-mono">{a.ip_address || '—'}</td><td className="p-2 text-slate-400 max-w-[240px] truncate" title={JSON.stringify(a.metadata)}>{Object.keys(a.metadata || {}).length ? JSON.stringify(a.metadata) : ''}</td></tr>)}</tbody></table></div>}
      {sub === 'chats' && <div className="space-y-2">{data.demoChats.map((c: any) => <button key={c.id} onClick={() => openChat(c)} className="w-full text-left bg-slate-800/60 hover:bg-slate-800 rounded-lg p-3 flex justify-between gap-3"><span className="text-sm text-white truncate flex items-center gap-2"><Bot className="w-4 h-4 text-violet-400 shrink-0" />{c.title}</span><span className="text-xs text-slate-400 whitespace-nowrap">{c.message_count} msgs · {fmt(c.updated_at)}</span></button>)}{!data.demoChats.length && <p className="text-sm text-slate-400">No demo chats.</p>}</div>}
      {sub === 'emails' && <EmailTable rows={data.emails} />}
    </div>)}
    {chat && <ChatModal id={chat.id} title={`Demo chat: ${chat.title}`} msgs={chat.msgs} onClose={() => setChat(null)} onDeleted={() => { setChat(null); reload() }} note={note} />}
  </Modal>)
}

const Transcript = ({ msgs }: { msgs: any[] }) => <div className="space-y-2">{msgs.map(m => <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : ''}`}><div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-200'}`}>{m.content}<p className="text-[10px] opacity-60 mt-1">{fmt(m.created_at)}</p></div></div>)}{!msgs.length && <p className="text-sm text-slate-400">Empty.</p>}</div>

function ChatModal({ id, title, msgs, onClose, onDeleted, note }: { id: string; title: string; msgs: any[]; onClose: () => void; onDeleted: () => void; note: (ok: boolean, t: string) => void }) {
  const [busy, setBusy] = useState(false)
  const del = async () => {
    if (!window.confirm('Permanently delete this demo chat and all its messages? This cannot be undone.')) return
    setBusy(true)
    try { await api(`/api/admin/visitors/demo-chats?chatId=${id}`, 'DELETE'); note(true, 'Demo chat permanently deleted.'); onDeleted() }
    catch (e: any) { note(false, e.message); setBusy(false) }
  }
  return (<Modal title={title} onClose={onClose}>
    <div className="space-y-4"><Transcript msgs={msgs} />
      <div className="pt-3 border-t border-slate-700 flex justify-end"><button disabled={busy} onClick={del} className={`${btn} border-red-500/40 text-red-400 hover:bg-red-500/10`}><Trash2 className="w-3.5 h-3.5" /> Delete permanently</button></div></div></Modal>)
}

function Chats({ note }: { note: (ok: boolean, t: string) => void }) {
  const { data, err, loading, reload } = useLoad<any>('/api/admin/visitors/demo-chats')
  const [chat, setChat] = useState<{ id: string; title: string; msgs: any[] } | null>(null)
  const open = async (c: any) => { try { const r = await api(`/api/admin/visitors/demo-chats?chatId=${c.id}`); setChat({ id: c.id, title: `${c.full_name} — ${c.title}`, msgs: r.messages }) } catch (e: any) { note(false, e.message) } }
  const remove = async (c: any) => {
    if (!window.confirm(`Permanently delete "${c.title}"? This cannot be undone.`)) return
    try { await api(`/api/admin/visitors/demo-chats?chatId=${c.id}`, 'DELETE'); note(true, 'Demo chat permanently deleted.'); reload() } catch (e: any) { note(false, e.message) }
  }
  if (loading) return <Loader />; if (err) return <ErrBox e={err} />
  return (<div className="space-y-2"><button onClick={reload} className={`${btn} border-slate-700 text-slate-300`}><RefreshCw className="w-3.5 h-3.5" /></button>
    {data.chats.map((c: any) => (<div key={c.id} className={`${panel} flex items-center gap-2 p-3 hover:bg-slate-800/60`}>
      <button onClick={() => open(c)} className="min-w-0 flex-1 text-left flex justify-between gap-3"><span className="min-w-0"><span className="block text-sm text-white truncate">{c.title}</span><span className="block text-xs text-slate-400">{c.full_name} · {c.visitor_code}</span></span><span className="text-xs text-slate-400 whitespace-nowrap">{c.message_count} msgs · {fmt(c.updated_at)}</span></button>
      <button onClick={() => remove(c)} aria-label="Delete demo chat" className="p-2 rounded-lg text-red-400 hover:bg-red-500/10"><Trash2 className="w-4 h-4" /></button></div>))}
    {!data.chats.length && <p className="text-sm text-slate-400 text-center py-8">No demo chats yet.</p>}
    {chat && <ChatModal id={chat.id} title={chat.title} msgs={chat.msgs} onClose={() => setChat(null)} onDeleted={() => { setChat(null); reload() }} note={note} />}</div>)
}

function EmailTable({ rows }: { rows: any[] }) {
  return <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="text-left text-slate-400"><th className="p-2">Time</th><th className="p-2">Sender</th><th className="p-2">To</th><th className="p-2">Type</th><th className="p-2">Status</th></tr></thead><tbody>{rows.map(r => <tr key={r.id} className="border-t border-slate-800 text-slate-300 align-top"><td className="p-2 whitespace-nowrap">{fmt(r.created_at)}</td><td className="p-2"><span className="block">{r.sender_type}</span><span className="text-slate-500">{r.from_address}</span></td><td className="p-2">{r.to_email}</td><td className="p-2">{r.notification_type}</td><td className="p-2"><Pill s={r.status} />{r.error_message && <p className="text-red-300 mt-1 max-w-[320px]">{r.error_message}</p>}</td></tr>)}</tbody></table>{!rows.length && <p className="text-sm text-slate-400 p-3">No emails logged.</p>}</div>
}
function Emails() {
  const { data, err, loading, reload } = useLoad<any>('/api/admin/visitors/emails')
  if (loading) return <Loader />; if (err) return <ErrBox e={err} />
  return <div className={`${panel} p-3 space-y-2`}><button onClick={reload} className={`${btn} border-slate-700 text-slate-300`}><RefreshCw className="w-3.5 h-3.5" /></button><EmailTable rows={data.emails} /></div>
}
