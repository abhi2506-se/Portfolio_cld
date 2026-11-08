import { sql } from './db'
import { defaultPortfolioData } from '@/lib/portfolio-data'

const pick = (o: any, keys: string[]) => Object.fromEntries(keys.filter(k => o && o[k] !== undefined).map(k => [k, o[k]]))

/**
 * READ-ONLY, WHITELISTED view of public portfolio content for the visitor dashboard.
 * Fields are copied explicitly (never spread), so new/private fields added to the stored data can't leak.
 */
export async function getExplorerData() {
  let raw: any = defaultPortfolioData
  try {
    const rows = await sql`SELECT data FROM portfolio_data WHERE key='main'`
    if (rows[0]?.data) raw = { ...defaultPortfolioData, ...rows[0].data }
  } catch { /* table may not exist → defaults */ }
  return {
    hero: pick(raw.hero, ['name', 'title', 'subtitle', 'description', 'location', 'currentJob', 'currentJobCompany', 'education', 'educationDegree', 'github', 'linkedin', 'available']),
    about: pick(raw.about, ['bio1', 'bio2', 'bio3']),
    skills: (raw.skills || []).map((s: any) => pick(s, ['title', 'skills'])),
    experience: (raw.experience || []).map((e: any) => pick(e, ['title', 'company', 'period', 'duration', 'location', 'description', 'highlights', 'technologies'])),
    education: (raw.education || []).map((e: any) => pick(e, ['degree', 'institution', 'school', 'period', 'duration', 'description'])),
    projects: (raw.projects || []).map((p: any) => ({
      ...pick(p, ['title', 'description', 'technologies', 'tech', 'github', 'githubUrl', 'liveUrl', 'link']),
      slug: String(p.slug || p.title || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
    })),
    certifications: (raw.certifications || []).map((c: any) => pick(c, ['name', 'issuer', 'date', 'credentialUrl'])),
  }
}
