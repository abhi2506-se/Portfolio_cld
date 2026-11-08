import { describe, it, expect } from 'vitest'
import { parseUserAgent } from '@/lib/visitor/ua'
import { accessRequestSchema, passwordSchema, preChatSchema, mobileSchema } from '@/lib/visitor/validation'
import { newVisitorCode, sha256, randomToken, hashPassword, verifyPassword, safeEqual } from '@/lib/visitor/crypto'
import { approvalEmail, resetEmail, activationUrl } from '@/lib/visitor/mailer'
import { APPROVAL_FROM, NOTIFICATIONS_FROM, SITE_URL } from '@/lib/visitor/config'

describe('user-agent parsing', () => {
  it('detects mobile / tablet / desktop', () => {
    expect(parseUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit Safari/604').deviceCategory).toBe('mobile')
    expect(parseUserAgent('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit Safari/604').deviceCategory).toBe('tablet')
    expect(parseUserAgent('Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit Chrome/120 Safari/537').deviceCategory).toBe('tablet')
    expect(parseUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit Chrome/120 Safari/537').deviceCategory).toBe('desktop')
  })
  it('detects browser and OS', () => {
    const r = parseUserAgent('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537 Chrome/120 Safari/537 Edg/120')
    expect(r.browser).toBe('Edge'); expect(r.os).toBe('Windows')
    expect(parseUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit Version/17 Safari/605').browser).toBe('Safari')
    expect(parseUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit Chrome/120 Mobile Safari').os).toBe('Android')
  })
})

describe('validation', () => {
  const ok = { fullName: 'Asha Rao', email: ' Asha@Corp.COM ', mobile: '+91 98765-43210', company: 'Corp', designation: 'CTO', purpose: 'Evaluating your work', linkedinUrl: '', websiteUrl: 'https://corp.com' }
  it('normalises a valid request', () => {
    const r = accessRequestSchema.parse(ok)
    expect(r.email).toBe('asha@corp.com'); expect(r.mobile).toBe('+919876543210'); expect(r.linkedinUrl).toBeNull()
  })
  it('rejects bad input', () => {
    expect(accessRequestSchema.safeParse({ ...ok, email: 'nope' }).success).toBe(false)
    expect(accessRequestSchema.safeParse({ ...ok, mobile: 'abc' }).success).toBe(false)
    expect(accessRequestSchema.safeParse({ ...ok, websiteUrl: 'javascript:alert(1)' }).success).toBe(false)
    expect(accessRequestSchema.safeParse({ ...ok, purpose: 'short' }).success).toBe(false)
  })
  it('enforces password policy', () => {
    expect(passwordSchema.safeParse('short1A').success).toBe(false)
    expect(passwordSchema.safeParse('alllowercase123').success).toBe(false)
    expect(passwordSchema.safeParse('GoodPassw0rd!').success).toBe(true)
  })
  it('pre-chat details are all mandatory', () => {
    expect(preChatSchema.safeParse({ name: 'A', email: 'a@b.co', mobile: '9876543210' }).success).toBe(false)
    expect(preChatSchema.safeParse({ name: 'Ab', email: 'a@b.co', mobile: '' }).success).toBe(false)
    expect(preChatSchema.safeParse({ name: 'Ab', email: 'a@b.co', mobile: '9876543210' }).success).toBe(true)
    expect(mobileSchema.safeParse('12').success).toBe(false)
  })
})

describe('crypto helpers', () => {
  it('visitor codes and tokens', () => {
    expect(newVisitorCode()).toMatch(/^VIS-[A-HJ-NP-Z2-9]{8}$/)
    expect(randomToken().length).toBeGreaterThanOrEqual(43)
    expect(randomToken()).not.toBe(randomToken())
    expect(sha256('x')).toHaveLength(64)
    expect(safeEqual('abc', 'abc')).toBe(true); expect(safeEqual('abc', 'abd')).toBe(false); expect(safeEqual('a', 'ab')).toBe(false)
  })
  it('bcrypt hashes verify', async () => {
    const h = await hashPassword('GoodPassw0rd!')
    expect(h.startsWith('$2')).toBe(true)
    expect(await verifyPassword('GoodPassw0rd!', h)).toBe(true)
    expect(await verifyPassword('wrong', h)).toBe(false)
  })
})

describe('email identities & templates', () => {
  it('uses the two required sender addresses', () => {
    expect(APPROVAL_FROM).toContain('visitors_approval@theabhisheksingh.in')
    expect(NOTIFICATIONS_FROM).toContain('visitors_notifications@theabhisheksingh.in')
  })
  it('links are built from the production origin and never contain a password', () => {
    expect(SITE_URL).toBe('https://www.theabhisheksingh.in')
    const m = approvalEmail({ name: 'Asha <b>', code: 'VIS-ABCDEFGH', expiresAt: new Date() }, 'tok123', 72)
    expect(m.html).toContain('https://www.theabhisheksingh.in/visitor/activate?token=tok123')
    expect(m.html).not.toContain('Asha <b>')          // name is HTML-escaped
    expect(m.html.toLowerCase()).not.toMatch(/your password is|temporary password/)
    expect(resetEmail('A', 'zzz', 24).html).toContain('mode=reset')
    expect(activationUrl('a b')).toContain('a%20b')
  })
})
