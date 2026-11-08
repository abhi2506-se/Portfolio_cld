import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'

/** Real Postgres (WASM) running the REAL migration SQL — so the visitor queries are tested against actual SQL semantics. */
export async function makeDb() {
  const db = new PGlite()
  const raw = ['visitor-system.sql', 'visitor-feature-access.sql'].map(f => readFileSync(new URL(`../prisma/migrations-sql/${f}`, import.meta.url), 'utf8')).join('\n')
  await db.exec(raw)
  const tag = async (strings: TemplateStringsArray, ...values: any[]) => {
    let text = strings[0]
    for (let i = 0; i < values.length; i++) text += `$${i + 1}` + strings[i + 1]
    const res = await db.query(text, values.map(v => (v instanceof Date ? v.toISOString() : v)))
    return res.rows as any[]
  }
  return { db, tag }
}
