/**
 * "Open MATLAB" action for the chat header.
 *
 * It sits in `conversation.session.header.actions` (a session-scoped list slot
 * owned by the conversation UI), so it appears in the chat main interface right
 * next to the session actions — not only inside the plugin settings page.
 */
import { useState, type CSSProperties } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { MatlabMcpKey } from './locales.ts'

/**
 * The slot this entry contributes to, declared locally: the owner package
 * (`@deepseek-ai/dsh-client-ui-conversation`) is part of the DSH shell, not a
 * dependency of this plugin, and the runtime declaration comes from there.
 */
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    'conversation.session.header.actions': { kind: 'list'; scope: 'session'; owner: { children?: never } }
  }
}

/** What the Host reports back after an open attempt. */
export interface MatlabOpenResult {
  pid?: number
  matlabRoot?: string
  sessionMode: string
  /** Whether the plugin's own MCP session already has a MATLAB running. */
  agentSession: boolean
  message: string
}

export interface MatlabOpenFace {
  open(): Promise<MatlabOpenResult>
}

export class MatlabOpenController {
  inject(): MatlabOpenFace {
    return { open: async () => await this.open() }
  }

  private async open(): Promise<MatlabOpenResult> {
    const response = await fetch('/api/dsh-matlab-mcp/open-matlab', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })
    let body: { ok?: boolean; error?: string; message?: string; result?: MatlabOpenResult } | undefined
    try {
      body = await response.json() as typeof body
    } catch {
      body = undefined
    }
    if (!response.ok || body?.ok !== true || body.result === undefined) {
      throw new Error([body?.error, body?.message].filter(part => typeof part === 'string' && part !== '').join(' — ') || ('HTTP ' + response.status))
    }
    return body.result
  }
}

export type MatlabOpenButtonProps =
  PropsRuntime<'conversation.session.header.actions'>
  & PropsLocale<'matlab-mcp'>
  & InjectFace<MatlabOpenFace>

const buttonStyle: CSSProperties = {
  appearance: 'none',
  font: 'inherit',
  cursor: 'pointer',
  border: '1px solid var(--dsw-alias-border-l2)',
  background: 'transparent',
  color: 'var(--dsw-alias-label-secondary)',
  borderRadius: 8,
  padding: '4px 10px',
  fontSize: 12,
  lineHeight: 1.5,
  whiteSpace: 'nowrap',
}

export function MatlabOpenButton(props: MatlabOpenButtonProps) {
  const { t } = props
  const [state, setState] = useState<'idle' | 'busy' | 'ok' | 'error'>('idle')
  const [detail, setDetail] = useState<string | undefined>()

  const onClick = async (): Promise<void> => {
    setState('busy')
    setDetail(undefined)
    try {
      const result = await props.open()
      setState('ok')
      setDetail(result.message)
      window.setTimeout(() => { setState('idle') }, 8000)
    } catch (error) {
      setState('error')
      setDetail(error instanceof Error ? error.message : String(error))
    }
  }

  const label = state === 'busy' ? t('button.opening') : state === 'ok' ? t('button.opened') : t('button.openMatlab')
  return (
    <button
      type="button"
      title={detail ?? t('button.openMatlabHint')}
      disabled={state === 'busy'}
      onClick={() => { void onClick() }}
      style={state === 'error' ? { ...buttonStyle, color: 'var(--dsw-alias-label-error)' } : state === 'busy' ? { ...buttonStyle, opacity: 0.6 } : buttonStyle}
    >
      {label}
    </button>
  )
}
