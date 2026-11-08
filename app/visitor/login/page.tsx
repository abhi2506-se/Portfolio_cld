'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { AuthShell, Field, Notice, fieldCls, primaryBtn, postJson } from '@/components/visitor/shell'

export default function VisitorLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => { fetch('/api/visitor/me', { credentials: 'same-origin' }).then(r => { if (r.ok) router.replace('/visitor/dashboard') }).catch(() => {}) }, [router])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('')
    const r = await postJson('/api/visitor/login', { email, password })
    if (r.ok) { router.replace('/visitor/dashboard'); return }
    setBusy(false); setErr(r.data.error || 'Sign in failed.')
  }

  return (
    <AuthShell title="Visitor Login" subtitle="Sign in to your private visitor dashboard.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email Address"><input type="email" className={fieldCls} value={email} onChange={e => setEmail(e.target.value)} required autoComplete="username" /></Field>
        <Field label="Password"><input type="password" className={fieldCls} value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" /></Field>
        {err && <Notice kind="error">{err}</Notice>}
        <button className={primaryBtn} disabled={busy}>{busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</> : 'Sign in'}</button>
        <p className="text-center text-xs text-muted-foreground">No account? <Link href="/visitor/request-access" className="text-blue-500 hover:underline">Request Visitor Access</Link></p>
        <p className="text-center text-[11px] text-muted-foreground">Forgot your password? Contact Abhishek and he'll send you a secure reset link.</p>
      </form>
    </AuthShell>
  )
}
