import { lazySql } from '@/lib/neon-lazy'

export type Row = Record<string, any>
/** Typed tagged-template Neon client (the shared lazy client returns a union type). */
export const sql = lazySql as unknown as (s: TemplateStringsArray, ...v: any[]) => Promise<Row[]>

/** Postgres "undefined_table" => the SQL migration has not been applied yet. */
export function isMissingTable(e: unknown): boolean {
  const any = e as any
  return any?.code === '42P01' || /relation "(visitors|visitor_[a-z_]+|demo_chats?|demo_chat_messages)" does not exist/i.test(String(any?.message || ''))
}
