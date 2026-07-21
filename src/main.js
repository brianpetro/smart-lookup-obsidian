import { SmartEnv, SmartPlugin } from 'obsidian-smart-env';
import { smart_env_config } from '../smart_env.config.js';
import { SmartLookupSettingsTab } from './views/settings_tab.js';
import { LookupItemView } from './views/lookup_item_view.js';
import { ReleaseNotesView } from './views/release_notes_view.js';

export default class SmartLookupPlugin extends SmartPlugin {
  SmartEnv = SmartEnv;
  ReleaseNotesView = ReleaseNotesView;

  get smart_env_config() {
    if (!this._smart_env_config) {
      this._smart_env_config = smart_env_config;
    }
    return this._smart_env_config;
  }

  LookupSettingsTab = SmartLookupSettingsTab;

  get item_views() {
    return {
      LookupItemView,
      ReleaseNotesView: this.ReleaseNotesView,
    };
  }

  onload() {
    this.app.workspace.onLayoutReady(this.initialize.bind(this));
    this.SmartEnv.create(this, this.smart_env_config);
    this.addSettingTab(new this.LookupSettingsTab(this.app, this, 'smart-lookup'));
    this.register_item_views({ skip_command_registration: true });
  }

  onunload() {
    console.log('Unloading Smart Lookup plugin');
    this.notices?.unload();
    this.env?.unload_main?.(this);
  }

  async initialize() {
    this.register_ribbon_actions();
    await this.SmartEnv.wait_for({ loaded: true });
    this.register_command_actions();
    await this.check_for_updates();
  }
}
