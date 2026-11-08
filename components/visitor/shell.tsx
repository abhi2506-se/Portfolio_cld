'use client'
import { ReactNode } from 'react'
import { ShieldCheck } from 'lucide-react'

export const fieldCls = 'w-full bg-secondary/60 border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 placeholder:text-muted-foreground/60 transition'
export const primaryBtn = 'inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white text-sm font-semibold disabled:opacity-50 hover:opacity-95 transition'

export function AuthShell({ title, subtitle, children, wide }: { title: string; subtitle?: string; children: ReactNode; wide?: boolean }) {
  return (
    <main className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-10 bg-background">
      <div className={`w-full ${wide ? 'max-w-xl' : 'max-w-md'} rounded-3xl border border-border bg-card text-card-foreground shadow-xl overflow-hidden`}>
        <div className="bg-gradient-to-br from-blue-600 to-violet-600 px-6 py-7 text-white">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] opacity-90"><ShieldCheck className="w-4 h-4" /> Visitor Access</div>
          <h1 className="mt-2 text-2xl font-bold leading-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-sm opacity-90">{subtitle}</p>}
        </div>
        <div className="p-6">{children}</div>
      </div>
    </main>
  )
}

export function Field({ label, hint, children, optional }: { label: string; hint?: string; children: ReactNode; optional?: boolean }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-muted-foreground mb-1.5">{label}{optional ? <span className="font-normal"> (optional)</span> : ' *'}</span>
      {children}
      {hint && <span className="block text-[11px] text-muted-foreground mt-1">{hint}</span>}
    </label>
  )
}

export function Notice({ kind, children }: { kind: 'error' | 'success' | 'info'; children: ReactNode }) {
  const cls = kind === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-500' : kind === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' : 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400'
  return <div role={kind === 'error' ? 'alert' : 'status'} className={`text-sm rounded-xl border px-3.5 py-2.5 ${cls}`}>{children}</div>
}

export async function postJson(url: string, body?: unknown) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}), credentials: 'same-origin' })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}
