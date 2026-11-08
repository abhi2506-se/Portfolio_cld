import { sql } from './db'
import { HttpError } from './api'
import { logAudit } from './audit'

/** Dashboard sections that admin must switch on per visitor. Missing row = locked. */
export const FEATURES = ['explorer', 'demo_chat'] as const
export type Feature = typeof FEATURES[number]
export type FeatureMap = Record<Feature, boolean>

export async function getFeatureAccess(visitorId: string): Promise<FeatureMap> {
  const rows = await sql`SELECT feature, granted FROM visitor_feature_access WHERE visitor_id = ${visitorId}`
  const map: FeatureMap = { explorer: false, demo_chat: false }
  for (const r of rows) if ((FEATURES as readonly string[]).includes(r.feature)) map[r.feature as Feature] = !!r.granted
  return map
}

/** Server-side gate used by every section API — the UI lock alone is never trusted. */
export async function requireFeature(visitorId: string, feature: Feature) {
  const rows = await sql`SELECT granted FROM visitor_feature_access WHERE visitor_id = ${visitorId} AND feature = ${feature}`
  if (!rows[0]?.granted) throw new HttpError(403, 'This section is locked. Abhishek has not enabled it for your account yet.')
}

export async function adminSetFeature(visitorId: string, feature: Feature, granted: boolean, adminId: string, m: { ip: string | null; ua: string }) {
  if (!(FEATURES as readonly string[]).includes(feature)) throw new HttpError(400, 'Unknown section.')
  const v = (await sql`SELECT id FROM visitors WHERE id = ${visitorId}`)[0]
  if (!v) throw new HttpError(404, 'Visitor not found.')
  await sql`INSERT INTO visitor_feature_access (visitor_id, feature, granted, updated_by, updated_at)
    VALUES (${visitorId}, ${feature}, ${granted}, ${adminId}, now())
    ON CONFLICT (visitor_id, feature) DO UPDATE SET granted = EXCLUDED.granted, updated_by = EXCLUDED.updated_by, updated_at = now()`
  await logAudit({ event: 'feature_access_changed', actor: 'admin', actorId: adminId, visitorId, ip: m.ip, ua: m.ua, meta: { feature, granted } })
}
