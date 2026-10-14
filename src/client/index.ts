import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { MatlabMcpSettingsCard, MatlabMcpSettingsCardController, type MatlabMcpSettings } from './MatlabMcpSettingsCard.tsx'
import { MatlabOpenButton, MatlabOpenController } from './MatlabOpenButton.tsx'
import { createMatlabMcpSettingsScope } from './settings-scope.ts'
import { en, zh, type MatlabMcpKey } from './locales.ts'

const NS = 'matlab-mcp'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'matlab-mcp': MatlabMcpKey
  }
}

export const inject = ['slots', 'locale']

export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'matlab-mcp: dictionaries')

  const settingsScope = createMatlabMcpSettingsScope<MatlabMcpSettings>()
  const controller = new MatlabMcpSettingsCardController(settingsScope)

  ctx.slots.inject('settings.section', () => {
    const unregister = ctx.slots.register({
      name: 'settings.section',
      id: 'matlab-mcp',
      order: 41,
      label: () => ctx.locale.bind(NS)('settings.title'),
      locale: NS,
      inject: () => controller.inject(),
    }, MatlabMcpSettingsCard)
    return () => {
      controller.dispose()
      unregister()
    }
  })

  // Chat main interface: an "Open MATLAB" action in the session header.
  const openController = new MatlabOpenController()
  ctx.slots.inject('conversation.session.header.actions', () => {
    const unregister = ctx.slots.register({
      name: 'conversation.session.header.actions',
      id: 'matlab-mcp-open',
      order: 40,
      label: () => ctx.locale.bind(NS)('button.openMatlab'),
      locale: NS,
      inject: () => openController.inject(),
    }, MatlabOpenButton)
    return () => { unregister() }
  })
}
