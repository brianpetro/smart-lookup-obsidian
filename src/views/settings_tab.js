import { SmartPluginSettingsTab } from 'obsidian-smart-env';
import { render_settings_config } from 'obsidian-smart-env/src/utils/render_settings_config.js';

export class SmartLookupSettingsTab extends SmartPluginSettingsTab {

  async render_plugin_settings(container) {
    if (!container) return;
    container.empty?.();

    const lookup_container = container.createDiv({
      cls: 'smart-lookup-settings__section',
      attr: { 'data-section-key': 'lookup_lists' },
    });

    const lookup_lists_settings_config = () => {
      return this.env.lookup_lists?.settings_config
        || this.env.config.collections.lookup_lists.settings_config
      ;
    };

    render_settings_config(
      lookup_lists_settings_config,
      this.env.lookup_lists,
      lookup_container,
      {
        default_group_name: 'Lookup lists',
        group_params: {
          'Lookup lists': {
            heading_btn: [
              {
                label: 'Learn about Smart Lookup',
                btn_text: 'Learn more',
                callback: () => window.open('https://smartconnections.app/smart-connections/lookup/?utm_source=lookup-settings-tab', '_external'),
              },
              {
                label: 'Settings documentation for Lookup Lists',
                btn_icon: 'help-circle',
                callback: () => window.open('https://smartconnections.app/smart-connections/settings/?utm_source=lookup-settings-tab#lookup-lists', '_external'),
              }
            ],
            order: 1,
          },
        }
      }
    );
  }
}
