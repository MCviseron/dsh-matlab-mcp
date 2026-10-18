import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { MatlabMcpKey } from './locales.ts'
import type { SettingsScope } from './settings-scope.ts'

export interface MatlabMcpSettings {
  enabled?: boolean
  announceToAgent?: boolean
  matlabRoot?: string
  sessionMode?: string
  displayMode?: string
  initialWorkingFolder?: string
  simulinkTools?: boolean
  skillsEnabled?: boolean
  skillGroups?: string
  toolCallTimeoutMs?: number
  allowMirrorDownload?: boolean
  downloadMirror?: string
  telemetry?: boolean
  shutdownMatlabOnUnload?: boolean
}

export interface MatlabMcpSettingsCardState {
  status: 'loading' | 'ready' | 'unavailable'
  config?: MatlabMcpSettings
  writable: boolean
}

/** The subset of `ProvisionState` the card renders. */
export interface MatlabMcpStatusState {
  home: string
  binary: { path: string; present: boolean; version?: string; bytes?: number }
  toolbox: { path: string; present: boolean }
  toolkits: Array<{ name: string; present: boolean }>
  simulink: { extensionFile: string; present: boolean }
  matlab: { root?: string; candidates: string[] }
  ready: boolean
}

/** One mirror's measured behaviour, as the Host reports it. */
export interface MirrorSpeed {
  template: string
  url: string
  ok: boolean
  ttfbMs?: number
  mbps?: number
  note?: string
}

export interface MatlabMcpSettingsCardFace {
  hooks: {
    matlabMcpSettingsCard: SnapshotStore<MatlabMcpSettingsCardState>
  }
  save(draft: MatlabMcpSettings): Promise<void>
  resetAll(): Promise<void>
  /** Speak MCP to the provisioned server; `deep` also runs one MATLAB call. */
  testConnection(deep: boolean): Promise<{ callText?: string } | undefined>
  /** One-click install/repair; returns the tail of the provisioning log. */
  install(): Promise<string[]>
  refreshStatus(): Promise<MatlabMcpStatusState | undefined>
  /** Probe the configured mirrors against a real artifact and rank them. */
  testMirrors(): Promise<{ results: MirrorSpeed[]; ordered: string[] }>
  reconnect(): Promise<void>
}

async function postJson<T>(path: string, body: unknown): Promise<{ response: Response; body?: T }> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  let parsed: T | undefined
  try {
    parsed = await response.json() as T
  } catch {
    parsed = undefined
  }
  return { response, ...(parsed === undefined ? {} : { body: parsed }) }
}

function failureMessage(payload: { error?: unknown; message?: unknown } | undefined, status: number): string {
  const code = typeof payload?.error === 'string' ? payload.error : undefined
  const message = typeof payload?.message === 'string' ? payload.message : undefined
  return [code, message].filter((part): part is string => part !== undefined && part !== '').join(' — ') || ('HTTP ' + status)
}

export class MatlabMcpSettingsCardController {
  private readonly store = createSnapshotStore<MatlabMcpSettingsCardState>({ status: 'loading', writable: false })
  private readonly disposeScope: () => void

  constructor(private readonly scope: SettingsScope<MatlabMcpSettings>) {
    this.disposeScope = scope.subscribe(() => { this.sync() })
    this.sync()
  }

  private sync(): void {
    const snapshot = this.scope.getSnapshot()
    this.store.set({
      status: snapshot.status,
      config: snapshot.value,
      writable: snapshot.writable,
    })
  }

  inject(): MatlabMcpSettingsCardFace {
    return {
      hooks: { matlabMcpSettingsCard: this.store },
      save: async (draft) => { await this.save(draft) },
      resetAll: async () => { await this.resetAll() },
      testConnection: async (deep) => await this.testConnection(deep),
      install: async () => await this.install(),
      refreshStatus: async () => await this.refreshStatus(),
      testMirrors: async () => await this.testMirrors(),
      reconnect: async () => { await this.reconnect() },
    }
  }

  dispose(): void {
    this.disposeScope()
  }

  private async save(draft: MatlabMcpSettings): Promise<void> {
    for (const [field, value] of Object.entries(draft)) {
      if (value === undefined || value === null || value === '') {
        await this.scope.unset(field)
      } else {
        await this.scope.set(field, value)
      }
    }
  }

  private async resetAll(): Promise<void> {
    const snapshot = this.scope.getSnapshot()
    const user = snapshot.user as Record<string, unknown> | undefined
    if (user === undefined) return
    for (const field of Object.keys(user)) {
      await this.scope.unset(field)
    }
  }

  private async testConnection(deep: boolean): Promise<{ callText?: string } | undefined> {
    const { response, body } = await postJson<{ ok?: boolean; error?: string; message?: string; result?: { callText?: string } }>('/api/dsh-matlab-mcp/test', { deep })
    if (!response.ok || body?.ok !== true) throw new Error(failureMessage(body, response.status))
    return body.result === undefined ? undefined : { ...(body.result.callText === undefined ? {} : { callText: body.result.callText }) }
  }

  private async install(): Promise<string[]> {
    const { response, body } = await postJson<{ ok?: boolean; error?: string; message?: string; logs?: string[] }>('/api/dsh-matlab-mcp/setup', {})
    if (!response.ok || body?.ok !== true) {
      const logs = body?.logs ?? []
      const detail = failureMessage(body, response.status)
      throw new Error(logs.length === 0 ? detail : detail + '\n' + logs.slice(-6).join('\n'))
    }
    return body.logs ?? []
  }

  private async testMirrors(): Promise<{ results: MirrorSpeed[]; ordered: string[] }> {
    const { response, body } = await postJson<{ ok?: boolean; error?: string; message?: string; results?: MirrorSpeed[]; ordered?: string[] }>('/api/dsh-matlab-mcp/mirrors/test', {})
    if (!response.ok || body?.ok !== true) throw new Error(failureMessage(body, response.status))
    return { results: body.results ?? [], ordered: body.ordered ?? [] }
  }

  private async refreshStatus(): Promise<MatlabMcpStatusState | undefined> {
    const { response, body } = await postJson<{ ok?: boolean; error?: string; message?: string; state?: MatlabMcpStatusState }>('/api/dsh-matlab-mcp/status', {})
    if (!response.ok || body?.ok !== true) return undefined
    return body.state
  }

  private async reconnect(): Promise<void> {
    const { response, body } = await postJson<{ ok?: boolean; error?: string; message?: string }>('/api/dsh-matlab-mcp/reconnect', {})
    if (!response.ok || body?.ok !== true) throw new Error(failureMessage(body, response.status))
  }
}

export type MatlabMcpSettingsCardProps =
  PropsRuntime<'settings.section'>
  & PropsLocale<'matlab-mcp'>
  & InjectFace<MatlabMcpSettingsCardFace>

const cardStyle: CSSProperties = {
  border: '1px solid var(--dsw-alias-border-l2)',
  background: 'var(--dsw-alias-bg-layer-3)',
  borderRadius: 12,
  color: 'var(--dsw-alias-label-primary)',
}

const headerStyle: CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px' }
const titleStyle: CSSProperties = { margin: 0, color: 'var(--dsw-alias-label-primary)', fontSize: 15, fontWeight: 600, lineHeight: 1.4 }
const descriptionStyle: CSSProperties = { margin: '4px 0 0', color: 'var(--dsw-alias-label-tertiary)', fontSize: 13, lineHeight: 1.5 }
const bodyStyle: CSSProperties = { borderTop: '1px solid var(--dsw-alias-border-l2)', margin: '0 16px', padding: '8px 0 12px' }
const footerStyle: CSSProperties = {
  borderTop: '1px solid var(--dsw-alias-border-l2)',
  display: 'flex',
  justifyContent: 'flex-end',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 8,
  margin: '0 16px',
  padding: '12px 0 16px',
}
const fieldStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 0' }
const labelStyle: CSSProperties = { color: 'var(--dsw-alias-label-primary)', fontSize: 13, fontWeight: 500, lineHeight: 1.5 }
const hintStyle: CSSProperties = { color: 'var(--dsw-alias-label-tertiary)', fontSize: 12, lineHeight: 1.5 }
const inputStyle: CSSProperties = {
  border: '1px solid var(--dsw-alias-border-l2)',
  background: 'var(--dsw-alias-bg-layer-3)',
  color: 'var(--dsw-alias-label-primary)',
  borderRadius: 8,
  padding: '0 12px',
  height: 34,
  fontSize: 13,
  lineHeight: 1.5,
  width: '100%',
  boxSizing: 'border-box',
  font: 'inherit',
}
const buttonBaseStyle: CSSProperties = {
  appearance: 'none',
  font: 'inherit',
  cursor: 'pointer',
  border: '1px solid transparent',
  borderRadius: 8,
  padding: '6px 16px',
  fontSize: 13,
  lineHeight: 1.5,
}
const primaryButtonStyle: CSSProperties = { ...buttonBaseStyle, background: 'var(--dsw-alias-label-primary)', color: 'var(--dsw-alias-bg-layer-3)' }
const secondaryButtonStyle: CSSProperties = { ...buttonBaseStyle, borderColor: 'var(--dsw-alias-border-l2)', background: 'transparent', color: 'var(--dsw-alias-label-secondary)' }
const disabledButtonStyle: CSSProperties = { opacity: 0.4, cursor: 'default' }
const preStyle: CSSProperties = {
  margin: '8px 0 0',
  padding: 10,
  borderRadius: 8,
  background: 'var(--dsw-alias-bg-layer-2)',
  color: 'var(--dsw-alias-label-secondary)',
  fontSize: 12,
  lineHeight: 1.5,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-all',
  maxHeight: 180,
  overflow: 'auto',
}
const statusRowStyle: CSSProperties = { display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 12, lineHeight: 1.6, color: 'var(--dsw-alias-label-secondary)' }
const badgeStyle: CSSProperties = {
  display: 'inline-block',
  padding: '0 8px',
  borderRadius: 999,
  fontSize: 11,
  lineHeight: '18px',
  border: '1px solid var(--dsw-alias-border-l2)',
}

interface FieldProps {
  label: string
  hint: string
  children: ReactNode
}

function Field(props: FieldProps) {
  return (
    <div style={fieldStyle}>
      <span style={labelStyle}>{props.label}</span>
      {props.children}
      <span style={hintStyle}>{props.hint}</span>
    </div>
  )
}

function TextField(props: { label: string; hint: string; value: string | undefined; disabled: boolean; onChange: (value: string) => void }) {
  return (
    <Field label={props.label} hint={props.hint}>
      <input type="text" value={props.value ?? ''} disabled={props.disabled} onChange={(event) => { props.onChange(event.target.value) }} style={inputStyle} />
    </Field>
  )
}

function NumberField(props: { label: string; hint: string; value: number | undefined; disabled: boolean; onChange: (value: number | undefined) => void }) {
  return (
    <Field label={props.label} hint={props.hint}>
      <input
        type="number"
        value={props.value ?? ''}
        disabled={props.disabled}
        onChange={(event) => {
          const text = event.target.value.trim()
          if (text === '') return props.onChange(undefined)
          const parsed = Number(text)
          props.onChange(Number.isFinite(parsed) ? parsed : undefined)
        }}
        style={inputStyle}
      />
    </Field>
  )
}

function SelectField(props: { label: string; hint: string; value: string; disabled: boolean; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  return (
    <Field label={props.label} hint={props.hint}>
      <select value={props.value} disabled={props.disabled} onChange={(event) => { props.onChange(event.target.value) }} style={inputStyle}>
        {props.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </Field>
  )
}

/**
 * Boolean settings render as a **switch**, not a checkbox: the track is a single
 * click target with `role="switch"` + `aria-checked`, which is what the rest of
 * the DSH settings UI uses for on/off preferences.
 */
function BooleanField(props: { label: string; hint: string; value: boolean; disabled: boolean; onChange: (value: boolean) => void }) {
  const trackStyle: CSSProperties = {
    appearance: 'none',
    font: 'inherit',
    position: 'relative',
    flex: '0 0 auto',
    width: 36,
    height: 20,
    padding: 0,
    border: '1px solid ' + (props.value ? 'transparent' : 'var(--dsw-alias-border-l2)'),
    borderRadius: 999,
    background: props.value ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-bg-layer-2)',
    cursor: props.disabled ? 'default' : 'pointer',
    opacity: props.disabled ? 0.4 : 1,
    transition: 'background 120ms ease, border-color 120ms ease',
  }
  const thumbStyle: CSSProperties = {
    position: 'absolute',
    top: 2,
    left: props.value ? 18 : 2,
    width: 14,
    height: 14,
    borderRadius: '50%',
    background: '#fff',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
    transition: 'left 120ms ease',
  }
  return (
    <Field label={props.label} hint={props.hint}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          type="button"
          role="switch"
          aria-checked={props.value}
          aria-label={props.label}
          disabled={props.disabled}
          onClick={() => { props.onChange(!props.value) }}
          style={trackStyle}
        >
          <span aria-hidden="true" style={thumbStyle} />
        </button>
        <span style={{ color: 'var(--dsw-alias-label-secondary)', fontSize: 12, lineHeight: 1.5 }}>
          {props.value ? '开 / on' : '关 / off'}
        </span>
      </div>
    </Field>
  )
}

export function MatlabMcpSettingsCard(props: MatlabMcpSettingsCardProps) {
  const { t } = props
  const state = props.useMatlabMcpSettingsCard(snapshot => snapshot)
  const [draft, setDraft] = useState<MatlabMcpSettings>({})
  const [seeded, setSeeded] = useState(false)
  const [busy, setBusy] = useState<'save' | 'test' | 'deep' | 'setup' | 'reconnect' | 'mirrors' | undefined>()
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | undefined>()
  const [status, setStatus] = useState<MatlabMcpStatusState | undefined>()
  const [statusLoading, setStatusLoading] = useState(true)
  const [mirrors, setMirrors] = useState<MirrorSpeed[]>([])
  const [mirrorOrder, setMirrorOrder] = useState<string[]>([])

  const loadStatus = async (): Promise<void> => {
    setStatusLoading(true)
    try {
      setStatus(await props.refreshStatus())
    } finally {
      setStatusLoading(false)
    }
  }

  useEffect(() => {
    if (!seeded && state.status === 'ready') {
      setDraft(state.config ?? {})
      setSeeded(true)
    }
  }, [seeded, state.status, state.config])

  useEffect(() => { void loadStatus() }, [])

  if (state.status === 'loading') return null

  const disabled = !state.writable || busy !== undefined
  const update = (field: keyof MatlabMcpSettings, value: unknown): void => {
    setDraft(current => ({ ...current, [field]: value }))
    setNotice(undefined)
  }

  const guard = async (kind: NonNullable<typeof busy>, action: () => Promise<void>): Promise<void> => {
    setBusy(kind)
    setNotice(undefined)
    try {
      await action()
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : String(error) })
    } finally {
      setBusy(undefined)
    }
  }

  const onSave = (): Promise<void> => guard('save', async () => {
    await props.save(draft)
    setNotice({ kind: 'ok', text: t('settings.saved') })
  })

  const onReset = (): Promise<void> => guard('save', async () => {
    await props.resetAll()
    setDraft(state.config ?? {})
    setNotice({ kind: 'ok', text: t('settings.saved') })
  })

  const onTest = (deep: boolean): Promise<void> => guard(deep ? 'deep' : 'test', async () => {
    await props.save(draft)
    const result = await props.testConnection(deep)
    setNotice({
      kind: 'ok',
      text: deep
        ? t('settings.deepTestOk') + (result?.callText === undefined ? '' : ' — ' + result.callText.split('\n').filter(line => line.trim() !== '').join(' | '))
        : t('settings.testOk'),
    })
    await loadStatus()
  })

  const onInstall = (): Promise<void> => guard('setup', async () => {
    await props.save(draft)
    const logs = await props.install()
    await props.reconnect()
    setNotice({ kind: 'ok', text: t('settings.setupOk') + (logs.length === 0 ? '' : ' — ' + logs.slice(-2).join(' | ')) })
    await loadStatus()
  })

  const onTestMirrors = (): Promise<void> => guard('mirrors', async () => {
    await props.save(draft)
    const measured = await props.testMirrors()
    setMirrors(measured.results)
    setMirrorOrder(measured.ordered)
    const best = measured.results.filter(entry => entry.ok).sort((left, right) => (right.mbps ?? 0) - (left.mbps ?? 0))[0]
    setNotice({ kind: 'ok', text: t('settings.mirrorTestOk') + (best === undefined ? '' : ' — ' + best.template + ' ' + (best.mbps ?? 0).toFixed(2) + ' MB/s') })
  })

  const onApplyFastestMirrors = (): Promise<void> => guard('save', async () => {
    const ordered = mirrorOrder.length > 0
      ? mirrorOrder
      : mirrors.filter(entry => entry.ok).sort((left, right) => (right.mbps ?? 0) - (left.mbps ?? 0)).map(entry => entry.template)
    if (ordered.length === 0) return
    const next: MatlabMcpSettings = { ...draft, downloadMirror: ordered.join(',') }
    setDraft(next)
    await props.save(next)
    setNotice({ kind: 'ok', text: t('settings.mirrorApplied') })
  })

  const onReconnect = (): Promise<void> => guard('reconnect', async () => {
    await props.save(draft)
    await props.reconnect()
    setNotice({ kind: 'ok', text: t('settings.reconnectOk') })
    await loadStatus()
  })

  const noticeStyle: CSSProperties = {
    margin: '8px 0 0',
    fontSize: 12,
    lineHeight: 1.5,
    flex: '1 1 100%',
    color: notice?.kind === 'ok' ? 'var(--dsw-alias-state-success-primary)' : 'var(--dsw-alias-label-error)',
    whiteSpace: 'pre-wrap',
  }

  return (
    <div style={cardStyle}>
      <header style={headerStyle}>
        <div>
          <h3 style={titleStyle}>{t('settings.title')}</h3>
          <p style={descriptionStyle}>{t('settings.description')}</p>
        </div>
      </header>

      <div style={bodyStyle}>
        <div style={{ ...statusRowStyle, flexWrap: 'wrap' }}>
          <strong>{t('settings.status')}</strong>
          {statusLoading
            ? <span>{t('settings.statusLoading')}</span>
            : status === undefined
              ? <span>{t('settings.statusUnavailable')}</span>
              : (
                  <>
                    <span style={badgeStyle}>{status.ready ? t('settings.statusReady') : t('settings.statusNotReady')}</span>
                    <span>MCP: {status.binary.present ? ('v' + (status.binary.version ?? '?')) : '✗'}</span>
                    <span>toolbox: {status.toolbox.present ? '✓' : '✗'}</span>
                    <span>toolkits: {status.toolkits.every(toolkit => toolkit.present) ? '✓' : '✗'}</span>
                    <span>MATLAB: {status.matlab.root ?? t('settings.noMatlab')}</span>
                  </>
                )}
        </div>
        {status !== undefined && status.matlab.candidates.length > 1
          ? <div style={statusRowStyle}><span>{t('settings.candidates')}: {status.matlab.candidates.join(' | ')}</span></div>
          : null}
        {status !== undefined
          ? <div style={statusRowStyle}><span>{status.home}</span></div>
          : null}
        <p style={{ ...hintStyle, margin: '6px 0 0' }}>{t('settings.installHint')}</p>

        <BooleanField label={t('settings.enabled')} hint={t('settings.enabledHint')} value={draft.enabled ?? true} disabled={disabled} onChange={(value) => { update('enabled', value) }} />
        <BooleanField label={t('settings.announceToAgent')} hint={t('settings.announceToAgentHint')} value={draft.announceToAgent ?? true} disabled={disabled} onChange={(value) => { update('announceToAgent', value) }} />
        <TextField label={t('settings.matlabRoot')} hint={t('settings.matlabRootHint')} value={draft.matlabRoot} disabled={disabled} onChange={(value) => { update('matlabRoot', value) }} />
        <SelectField
          label={t('settings.sessionMode')}
          hint={t('settings.sessionModeHint')}
          value={draft.sessionMode ?? 'new'}
          disabled={disabled}
          options={[
            { value: 'new', label: t('settings.sessionModeNew') },
            { value: 'auto', label: t('settings.sessionModeAuto') },
            { value: 'existing', label: t('settings.sessionModeExisting') },
          ]}
          onChange={(value) => { update('sessionMode', value) }}
        />
        <SelectField
          label={t('settings.displayMode')}
          hint={t('settings.displayModeHint')}
          value={draft.displayMode ?? 'desktop'}
          disabled={disabled}
          options={[
            { value: 'desktop', label: t('settings.displayModeDesktop') },
            { value: 'nodesktop', label: t('settings.displayModeNodesktop') },
          ]}
          onChange={(value) => { update('displayMode', value) }}
        />
        <TextField label={t('settings.initialWorkingFolder')} hint={t('settings.initialWorkingFolderHint')} value={draft.initialWorkingFolder} disabled={disabled} onChange={(value) => { update('initialWorkingFolder', value) }} />
        <BooleanField label={t('settings.simulinkTools')} hint={t('settings.simulinkToolsHint')} value={draft.simulinkTools ?? true} disabled={disabled} onChange={(value) => { update('simulinkTools', value) }} />
        <BooleanField label={t('settings.skillsEnabled')} hint={t('settings.skillsEnabledHint')} value={draft.skillsEnabled ?? true} disabled={disabled} onChange={(value) => { update('skillsEnabled', value) }} />
        <TextField label={t('settings.skillGroups')} hint={t('settings.skillGroupsHint')} value={draft.skillGroups} disabled={disabled} onChange={(value) => { update('skillGroups', value) }} />
        <NumberField label={t('settings.toolCallTimeoutMs')} hint={t('settings.toolCallTimeoutMsHint')} value={draft.toolCallTimeoutMs} disabled={disabled} onChange={(value) => { update('toolCallTimeoutMs', value) }} />
        <BooleanField label={t('settings.allowMirrorDownload')} hint={t('settings.allowMirrorDownloadHint')} value={draft.allowMirrorDownload ?? false} disabled={disabled} onChange={(value) => { update('allowMirrorDownload', value) }} />
        <TextField label={t('settings.downloadMirror')} hint={t('settings.downloadMirrorHint')} value={draft.downloadMirror} disabled={disabled} onChange={(value) => { update('downloadMirror', value) }} />
        <Field label={t('settings.mirrorTest')} hint={t('settings.mirrorTestHint')}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              disabled={disabled}
              style={disabled ? { ...secondaryButtonStyle, ...disabledButtonStyle } : secondaryButtonStyle}
              onClick={() => { void onTestMirrors() }}
            >
              {t(busy === 'mirrors' ? 'settings.mirrorTesting' : 'settings.mirrorTestRun')}
            </button>
            {mirrors.some(entry => entry.ok)
              ? (
                  <button
                    type="button"
                    disabled={disabled}
                    style={disabled ? { ...secondaryButtonStyle, ...disabledButtonStyle } : secondaryButtonStyle}
                    onClick={() => { void onApplyFastestMirrors() }}
                  >
                    {t('settings.mirrorApplyFastest')}
                  </button>
                )
              : null}
          </div>
          {mirrors.length > 0
            ? (
                <pre style={preStyle}>
                  {mirrors
                    .map(entry => (entry.ok
                      ? `${(entry.mbps ?? 0).toFixed(2)} MB/s  ${entry.ttfbMs === undefined ? '' : entry.ttfbMs + ' ms  '}${entry.template}`
                      : `✗            ${entry.template}  (${entry.note ?? 'failed'})`))
                    .join('\n')}
                </pre>
              )
            : null}
        </Field>
        <BooleanField label={t('settings.telemetry')} hint={t('settings.telemetryHint')} value={draft.telemetry ?? false} disabled={disabled} onChange={(value) => { update('telemetry', value) }} />
        <BooleanField label={t('settings.shutdownMatlabOnUnload')} hint={t('settings.shutdownMatlabOnUnloadHint')} value={draft.shutdownMatlabOnUnload ?? true} disabled={disabled} onChange={(value) => { update('shutdownMatlabOnUnload', value) }} />
      </div>

      <footer style={footerStyle}>
        {notice !== undefined ? <p style={noticeStyle} role="status">{notice.text}</p> : null}
        <button type="button" disabled={disabled} style={disabled ? { ...primaryButtonStyle, ...disabledButtonStyle } : primaryButtonStyle} onClick={() => { void onSave() }}>
          {t(busy === 'save' ? 'settings.saving' : 'settings.save')}
        </button>
        <button type="button" disabled={disabled} style={disabled ? { ...secondaryButtonStyle, ...disabledButtonStyle } : secondaryButtonStyle} onClick={() => { void onInstall() }}>
          {t(busy === 'setup' ? 'settings.settingUp' : 'settings.setup')}
        </button>
        <button type="button" disabled={disabled} style={disabled ? { ...secondaryButtonStyle, ...disabledButtonStyle } : secondaryButtonStyle} onClick={() => { void onTest(false) }}>
          {t(busy === 'test' ? 'settings.testingConnection' : 'settings.testConnection')}
        </button>
        <button type="button" disabled={disabled} style={disabled ? { ...secondaryButtonStyle, ...disabledButtonStyle } : secondaryButtonStyle} onClick={() => { void onTest(true) }}>
          {t(busy === 'deep' ? 'settings.deepTesting' : 'settings.deepTest')}
        </button>
        <button type="button" disabled={disabled} style={disabled ? { ...secondaryButtonStyle, ...disabledButtonStyle } : secondaryButtonStyle} onClick={() => { void onReconnect() }}>
          {t(busy === 'reconnect' ? 'settings.reconnecting' : 'settings.reconnect')}
        </button>
        <button type="button" disabled={disabled || statusLoading} style={disabled || statusLoading ? { ...secondaryButtonStyle, ...disabledButtonStyle } : secondaryButtonStyle} onClick={() => { void loadStatus() }}>
          {t('settings.refreshStatus')}
        </button>
        <button type="button" disabled={disabled} style={disabled ? { ...secondaryButtonStyle, ...disabledButtonStyle } : secondaryButtonStyle} onClick={() => { void onReset() }}>
          {t('settings.resetAll')}
        </button>
      </footer>

      {notice?.kind === 'error'
        ? <pre style={preStyle}>{notice.text}</pre>
        : null}
    </div>
  )
}
