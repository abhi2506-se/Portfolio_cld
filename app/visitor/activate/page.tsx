'use client'
import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { AuthShell, Field, Notice, fieldCls, primaryBtn, postJson } from '@/components/visitor/shell'

function Inner() {
  const token = useSearchParams().get('token') || ''
  const [state, setState] = useState<'checking' | 'valid' | 'invalid' | 'done'>('checking')
  const [type, setType] = useState('activation')
  const [pw, setPw] = useState(''); const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('')

  useEffect(() => {
    if (!token) { setState('invalid'); return }
    fetch(`/api/visitor/activate?token=${encodeURIComponent(token)}`).then(r => r.json()).then(d => {
      if (d.valid) { setType(d.type); setState('valid') } else setState('invalid')
    }).catch(() => setState('invalid'))
  }, [token])

  const isReset = type === 'password_reset'
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('')
    if (pw !== pw2) { setErr('Passwords do not match.'); return }
    setBusy(true)
    const r = await postJson('/api/visitor/activate', { token, password: pw })
    setBusy(false)
    if (r.ok) setState('done'); else setErr(r.data.error || 'Could not save your password.')
  }

  return (
    <AuthShell title={isReset ? 'Reset your password' : 'Activate your account'} subtitle={isReset ? 'Choose a new password.' : 'Choose a password to finish setting up.'}>
      {state === 'checking' && <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>}
      {state === 'invalid' && <div className="space-y-3"><Notice kind="error">This link is invalid, already used, or has expired.</Notice><p className="text-sm text-muted-foreground">Please ask Abhishek to send you a new link.</p></div>}
      {state === 'done' && (
        <div className="text-center space-y-4"><CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
          <p className="text-sm">Your password is set. You can sign in now.</p>
          <Link href="/visitor/login" className={primaryBtn}>Go to Visitor Login</Link></div>
      )}
      {state === 'valid' && (
        <form onSubmit={submit} className="space-y-4">
          <Field label="New password" hint="At least 10 characters with upper-case, lower-case and a number."><input type="password" className={fieldCls} value={pw} onChange={e => setPw(e.target.value)} required minLength={10} maxLength={128} autoComplete="new-password" /></Field>
          <Field label="Confirm password"><input type="password" className={fieldCls} value={pw2} onChange={e => setPw2(e.target.value)} required autoComplete="new-password" /></Field>
          {err && <Notice kind="error">{err}</Notice>}
          <button className={primaryBtn} disabled={busy}>{busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : isReset ? 'Reset password' : 'Activate account'}</button>
        </form>
      )}
    </AuthShell>
  )
}
export default function ActivatePage() { return <Suspense fallback={null}><Inner /></Suspense> }
