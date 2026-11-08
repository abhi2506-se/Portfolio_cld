import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'crypto'
import bcrypt from 'bcryptjs'

export const newId = () => randomUUID()
/** 256-bit URL-safe random token (raw value goes to the user; only its hash is stored). */
export const randomToken = () => randomBytes(32).toString('base64url')
export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a); const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I
export function newVisitorCode(): string {
  const bytes = randomBytes(8)
  let out = ''
  for (let i = 0; i < 8; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length]
  return `VIS-${out}`
}

const BCRYPT_COST = 12
export const hashPassword = (pw: string) => bcrypt.hash(pw, BCRYPT_COST)
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash)
let _dummy: string | null = null
/** Hash compared against when an account doesn't exist, so response time doesn't reveal which emails are registered. */
export const dummyHash = () => (_dummy ??= bcrypt.hashSync('timing-equaliser-not-a-password', BCRYPT_COST))
