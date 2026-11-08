/**
 * Applies prisma/migrations-sql/visitor-system.sql to the database in DATABASE_URL.
 *
 *   node scripts/apply-visitor-migration.mjs           -> DRY RUN: prints what it would run, touches nothing
 *   node scripts/apply-visitor-migration.mjs --apply   -> runs it in ONE transaction (all-or-nothing)
 *
 * The SQL is purely additive (CREATE TABLE/INDEX IF NOT EXISTS) — it never drops, alters or renames existing tables.
 * Nothing in the app runs this automatically.
 */
import { readFileSync } from 'node:fs'
import { neon } from '@neondatabase/serverless'

const files = ['visitor-system.sql', 'visitor-feature-access.sql']
const raw = files.map(f => readFileSync(new URL(`../prisma/migrations-sql/${f}`, import.meta.url), 'utf8')).join('\n')
const statements = raw
  .split('\n').map(l => l.replace(/--.*$/, '')).join('\n')   // strip comments (none of the SQL contains '--' inside strings)
  .split(';').map(s => s.trim()).filter(s => s && !/^(BEGIN|COMMIT)$/i.test(s))

const apply = process.argv.includes('--apply')
console.log(`${statements.length} statements, ${statements.filter(s => /^CREATE TABLE/i.test(s)).length} tables (${files.join(' + ')}).`)
if (!apply) {
  for (const s of statements) console.log('  •', s.split('\n')[0].slice(0, 110))
  console.log('\nDRY RUN — nothing was executed. Re-run with --apply to execute.')
  process.exit(0)
}
if (!process.env.DATABASE_URL) { console.error('DATABASE_URL is not set'); process.exit(1) }
const sql = neon(process.env.DATABASE_URL)
await sql.transaction(statements.map(s => sql(s)))
console.log('Migration applied.')
