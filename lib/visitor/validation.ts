import { z } from 'zod'

const clean = (s: string) => s.replace(/[\u0000-\u001f\u007f]/g, '').trim()
const text = (min: number, max: number) => z.string().transform(clean).pipe(z.string().min(min).max(max))
const optUrl = z.string().transform(clean).pipe(
  z.union([
    z.literal(''),
    z.string().max(300).url().refine(u => /^https?:\/\//i.test(u), 'Must start with http(s)://'),
  ])
).optional().transform(v => v || null)

export const mobileSchema = z.string().transform(s => s.replace(/[\s().-]/g, '')).pipe(z.string().regex(/^\+?[0-9]{7,15}$/, 'Enter a valid mobile number'))
export const emailSchema = z.string().transform(s => s.trim().toLowerCase()).pipe(z.string().email().max(254))

export const accessRequestSchema = z.object({
  fullName: text(2, 100),
  email: emailSchema,
  mobile: mobileSchema,
  company: text(2, 150),
  designation: text(2, 120),
  purpose: text(10, 1000),
  linkedinUrl: optUrl,
  websiteUrl: optUrl,
})

export const passwordSchema = z.string()
  .min(10, 'Use at least 10 characters')
  .max(128)
  .refine(p => /[a-z]/.test(p) && /[A-Z]/.test(p) && /[0-9]/.test(p), 'Use upper-case, lower-case and a number')

export const adminCreateVisitorSchema = accessRequestSchema.extend({
  validityDays: z.number().int().min(1).max(365).optional(),
})

export const preChatSchema = z.object({
  name: text(2, 100),
  email: emailSchema,
  mobile: mobileSchema,
})

export function firstError(e: unknown): string {
  if (e instanceof z.ZodError) return e.issues[0]?.message || 'Invalid input'
  return 'Invalid input'
}
