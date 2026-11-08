'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { AuthShell, Field, Notice, fieldCls, primaryBtn, postJson } from '@/components/visitor/shell'

export default function RequestAccessPage() {
  const [f, setF] = useState({ fullName: '', email: '', mobile: '', company: '', designation: '', purpose: '', linkedinUrl: '', websiteUrl: '', website_hp: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState(false)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF(p => ({ ...p, [k]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('')
    const r = await postJson('/api/visitor/request-access', f)
    setBusy(false)
    if (r.ok) setDone(true); else setErr(r.data.error || 'Could not submit your request.')
  }

  if (done) return (
    <AuthShell title="Request received" subtitle="Thank you — it's now pending review.">
      <div className="text-center space-y-4">
        <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
        <p className="text-sm text-muted-foreground">Abhishek reviews every request personally. If approved, you'll receive an email with a secure link to activate your account.</p>
        <Link href="/" className="text-sm text-blue-500 hover:underline">Back to portfolio</Link>
      </div>
    </AuthShell>
  )

  return (
    <AuthShell title="Request Visitor Access" subtitle="Get a private dashboard to explore the portfolio. Access is approved manually." wide>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Full Name"><input className={fieldCls} value={f.fullName} onChange={set('fullName')} required minLength={2} maxLength={100} autoComplete="name" /></Field>
          <Field label="Email Address"><input type="email" className={fieldCls} value={f.email} onChange={set('email')} required maxLength={254} autoComplete="email" /></Field>
          <Field label="Mobile Number"><input type="tel" className={fieldCls} value={f.mobile} onChange={set('mobile')} required placeholder="+91 98765 43210" autoComplete="tel" /></Field>
          <Field label="Company / Organization"><input className={fieldCls} value={f.company} onChange={set('company')} required maxLength={150} autoComplete="organization" /></Field>
          <div className="sm:col-span-2"><Field label="Designation"><input className={fieldCls} value={f.designation} onChange={set('designation')} required maxLength={120} autoComplete="organization-title" /></Field></div>
        </div>
        <Field label="Purpose of visit" hint="Min. 10 characters"><textarea className={`${fieldCls} resize-none`} rows={3} value={f.purpose} onChange={set('purpose')} required minLength={10} maxLength={1000} /></Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="LinkedIn Profile" optional><input type="url" className={fieldCls} value={f.linkedinUrl} onChange={set('linkedinUrl')} placeholder="https://linkedin.com/in/…" /></Field>
          <Field label="Website" optional><input type="url" className={fieldCls} value={f.websiteUrl} onChange={set('websiteUrl')} placeholder="https://" /></Field>
        </div>
        {/* honeypot — hidden from humans */}
        <input tabIndex={-1} autoComplete="off" aria-hidden="true" value={f.website_hp} onChange={set('website_hp')} className="absolute -left-[9999px] h-0 w-0 opacity-0" />
        {err && <Notice kind="error">{err}</Notice>}
        <button className={primaryBtn} disabled={busy}>{busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</> : 'Submit request'}</button>
        <p className="text-center text-xs text-muted-foreground">Already approved? <Link href="/visitor/login" className="text-blue-500 hover:underline">Visitor Login</Link></p>
      </form>
    </AuthShell>
  )
}
