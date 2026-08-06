declare module '*.css' {
  const stylesheet: string;
  export default stylesheet;
}

declare module '*.md' {
  const markdown: string;
  export default markdown;
}

declare module 'obsidian-smart-env' {
  import type {
    LookupApp,
    LookupEnvironment,
    LookupPlugin,
  } from 'jsbrains/smart-types';

  export class SmartEnv {
    static create(plugin: SmartPlugin, env_config: object): Promise<LookupEnvironment>;
    static wait_for(opts?: { loaded?: boolean }): Promise<LookupEnvironment>;
  }

  export class SmartPlugin implements LookupPlugin {
    SmartEnv: typeof SmartEnv;
    manifest: { id: string, version?: string };
    app: LookupApp;
    env: LookupEnvironment & {
      build_menu: NonNullable<LookupEnvironment['build_menu']>;
    };
    notices?: { unload: () => void };
    addSettingTab(tab: unknown): void;
    register_item_views(params?: { skip_command_registration?: boolean }): void;
    registerEvent(event_ref: unknown): void;
    register_ribbon_actions(): void;
    register_command_actions(): void;
    check_for_updates(): Promise<void>;
  }

  export class SmartPluginSettingsTab {
    constructor(app: LookupApp, plugin: SmartPlugin, icon_name?: string);
    env: LookupEnvironment;
  }
}

declare module 'obsidian-smart-env/views/smart_item_view.js' {
  import type {
    LookupApp,
    LookupEnvironment,
    LookupPlugin,
    LookupView,
  } from 'jsbrains/smart-types';

  export class SmartItemView implements LookupView {
    env: LookupEnvironment;
    plugin?: LookupPlugin;
    app?: LookupApp;
    readonly container: HTMLElement;
  }
}

declare module 'obsidian-smart-env/views/release_notes_view.js' {
  import { SmartItemView } from 'obsidian-smart-env/views/smart_item_view.js';

  export class ReleaseNotesView extends SmartItemView {
    static view_type: string;
    static display_text: string;
    static icon_name: string;
    static plugin_id: string;
    static release_notes_md: string;
  }
}

declare module 'obsidian-smart-env/src/collections/lookup_lists.js' {
  import type {
    SettingsConfig,
    SmartEnvCollectionConfig,
  } from 'jsbrains/smart-types';

  export const settings_config: SettingsConfig;
  const lookup_lists_config: SmartEnvCollectionConfig;
  export default lookup_lists_config;
}

declare module 'obsidian-smart-env/src/utils/get_item_display_name.js' {
  import type { LookupGetItemDisplayName } from 'jsbrains/smart-types';

  export const DISPLAY_SEPARATOR: string;
  export const get_item_display_name: LookupGetItemDisplayName;
}

declare module 'obsidian-smart-env/src/utils/register_item_hover_popover.js' {
  import type { LookupRegisterItemHoverPopover } from 'jsbrains/smart-types';

  export const register_item_hover_popover: LookupRegisterItemHoverPopover;
}

declare module 'obsidian-smart-env/src/utils/register_item_drag.js' {
  import type { LookupRegisterItemDrag } from 'jsbrains/smart-types';

  export const register_item_drag: LookupRegisterItemDrag;
}

declare module 'obsidian-smart-env/src/utils/open_source.js' {
  import type { LookupOpenSource } from 'jsbrains/smart-types';

  export const open_source: LookupOpenSource;
}

declare module 'obsidian-smart-env/src/utils/render_settings_config.js' {
  import type { LookupRenderSettingsConfig } from 'jsbrains/smart-types';

  export const render_settings_config: LookupRenderSettingsConfig;
}
