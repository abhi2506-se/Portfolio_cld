import { defaultPortfolioData } from '@/lib/portfolio-data'

const MODEL = 'claude-sonnet-4-6'
const d = defaultPortfolioData

const SYSTEM_PROMPT = `You are the AI assistant in the DEMO chat on Abhishek Singh's portfolio website.
This is a demo experience: it is not a conversation with Abhishek himself, and nothing said here is forwarded to him.
Be warm, concise and professional (a few sentences). Answer using only the facts below; if you don't know, say so and suggest the visitor use the contact options.
Never claim to book meetings, send files, or take any action. Decline sexual, harmful or off-topic requests politely and steer back to the portfolio.

Facts:
- ${d.hero.name} — ${d.hero.title}. ${d.hero.description}
- Based in: ${d.hero.location}.
- Skills: ${d.skills.map((s: any) => `${s.title}: ${s.skills.join(', ')}`).join(' | ')}`

export interface DemoMsg { role: 'user' | 'assistant'; content: string }

/** Returns null when the API key is missing or the call fails; callers show a friendly fallback. */
export async function generateDemoReply(history: DemoMsg[], visitorName?: string): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: MODEL, max_tokens: 400,
        system: SYSTEM_PROMPT + (visitorName ? `\nThe visitor's name is ${visitorName.replace(/[^\p{L}\p{N} .'-]/gu, '').slice(0, 60)}.` : ''),
        messages: history.slice(-20),
      }),
      signal: AbortSignal.timeout(25000),
    })
    if (!res.ok) { console.error('[demo-ai] API error', res.status); return null }
    const data = await res.json()
    const text = (data.content || []).map((b: any) => (b.type === 'text' ? b.text : '')).filter(Boolean).join('\n').trim()
    return text || null
  } catch (e) { console.error('[demo-ai] request failed', e); return null }
}
