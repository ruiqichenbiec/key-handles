import type { Register } from 'claude-code'

// PROTOTYPE. This is the code the demo video was recorded with. Use fake keys only.
//   - a key in a submitted prompt is replaced by a handle and kept in memory;
//   - the model may write the handle in any tool input; it is swapped back when the tool runs;
//   - every string in a tool result is masked again before the model reads it;
//   - the submit guard fails closed: if it crashes, the prompt is withheld.
// Limits: one key pattern (sk-ant-api03-*), one handle, plain text only, nothing saved to disk.

const KEY = /sk-ant-api03-[A-Za-z0-9_-]{20,}/g
const HANDLE = '[[secret:anthropic-key#1 provider=Anthropic format=sk-ant-api03-*]]'
const USE = '[[use:anthropic-key#1]]'
const NOTE =
  'Secret handles: before you see a message or a tool result, any API key in it is replaced by a handle ' +
  'of the form [[secret:NAME provider=... format=...]]. You never see the real value. When a command or a ' +
  'file needs the key, write the handle exactly as it appears: it is swapped for the real value on this ' +
  'machine when the tool runs. Treat a handle as the key itself and do not ask the user for the real value.'

let vault: string | undefined // memory only; gone when the session ends

const mask = (s: string): string =>
  s.replace(KEY, found => {
    vault ??= found
    return HANDLE
  })
const reveal = (s: string): string =>
  vault === undefined ? s : s.split(HANDLE).join(vault).split(USE).join(vault)

const RESERVED = new Set(['tool', 'tool_use_id', 'consent'])
const NONE = new Set<string>()

// Apply `fn` to every string inside a plain value; `seen.changed` turns true when one differs.
function deep(value: unknown, fn: (s: string) => string, skip: Set<string>, seen: { changed: boolean }): unknown {
  if (typeof value === 'string') {
    const next = fn(value)
    if (next !== value) seen.changed = true
    return next
  }
  if (Array.isArray(value)) return value.map(v => deep(v, fn, skip, seen))
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = skip.has(k) ? v : deep(v, fn, skip, seen)
    }
    return out
  }
  return value
}

export const register: Register = on => {
  // Tell the model what a handle is and how to use one.
  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    return { sections: [...composed.sections, { id: 'key-handles-demo:handles', text: NOTE, scope: 'session' }] }
  })

  // Mask at submit; withhold the prompt if the guard itself fails.
  on('prompt.submit', ($, e, next) => {
    if (e.command) return next(e)
    const masked = mask(e.text)
    return next(masked === e.text ? e : { ...e, text: masked })
  }).catch(($, e, next) => (next.called ? next(e) : { drop: 'key-handles-demo: guard failed, prompt withheld' }))

  // Every tool: swap the handle for the value in string inputs, run, then mask every string in the result.
  on('tool.call', async ($, e, next) => {
    const input = { changed: false }
    const swapped = deep(e, reveal, RESERVED, input) as typeof e
    const ran = await next(input.changed ? swapped : e)
    if (ran.deny !== undefined || ran.isError === true) return ran
    const output = { changed: false }
    const masked = deep(ran.result, mask, NONE, output)
    return output.changed ? { result: masked as typeof ran.result } : ran
  })
}
