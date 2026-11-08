import { describe, it, expect, vi } from 'vitest'
vi.mock('@/lib/neon-lazy', async () => { const { makeDb } = await import('./helpers'); const { tag } = await makeDb(); return { lazySql: tag } })
import { getExplorerData } from '@/lib/visitor/explorer'
import * as explorerRoute from '@/app/api/visitor/explorer/route'
import * as demoRoute from '@/app/api/visitor/demo-chat/route'

describe('visitor console is read-only and whitelisted', () => {
  it('explorer exposes no write methods', () => {
    expect(Object.keys(explorerRoute).sort()).toEqual(['GET', 'dynamic', 'runtime'].sort())
  })
  it('explorer hero never carries contact email or private keys', async () => {
    const d = await getExplorerData()
    expect(d.hero).not.toHaveProperty('email')
    expect(d.hero).not.toHaveProperty('phone')
    expect(Object.keys(d).sort()).toEqual(['about', 'certifications', 'education', 'experience', 'hero', 'projects', 'skills'])
  })
  it('demo chat route only allows the visitor their own chats (GET + POST)', () => {
    expect(typeof demoRoute.GET).toBe('function'); expect(typeof demoRoute.POST).toBe('function')
    expect((demoRoute as any).PUT).toBeUndefined(); expect((demoRoute as any).DELETE).toBeUndefined()
  })
})
