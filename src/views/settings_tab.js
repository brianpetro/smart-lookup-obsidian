import { SmartPluginSettingsTab } from 'obsidian-smart-env';
import { render_settings_config as raw_render_settings_config } from 'obsidian-smart-env/src/utils/render_settings_config.js';

/**
 * @typedef {import('smart-types').SettingsConfig} SettingsConfig
 * @typedef {import('obsidian-smart-env').ObsidianHTMLElement} ObsidianContainerEl
 */

const render_settings_config = /** @type {(settings_config: (() => SettingsConfig), scope: import('smart-types').LookupListsCollectionLike, container: HTMLElement, params?: import('smart-types').LookupRenderSettingsParams) => unknown} */ (raw_render_settings_config);

export class SmartLookupSettingsTab extends SmartPluginSettingsTab {

  /**
   * @param {ObsidianContainerEl|null|undefined} container
   * @returns {Promise<void>}
   */
  async render_plugin_settings(container) {
    if (!container) return;
    container.empty?.();

    const env = get_lookup_env(this);
    const lookup_container = container.createDiv({
      cls: 'smart-lookup-settings__section',
      attr: { 'data-section-key': 'lookup_lists' },
    });

    /** @returns {SettingsConfig} */
    const lookup_lists_settings_config = () => {
      return env.lookup_lists.settings_config
        || env.config.collections.lookup_lists.settings_config
      ;
    };

    render_settings_config(
      lookup_lists_settings_config,
      env.lookup_lists,
      lookup_container,
      {
        default_group_name: 'Lookup lists',
        group_params: {
          'Lookup lists': {
            heading_btn: [
              {
                label: 'Learn about Smart Lookup',
                btn_text: 'Learn more',
                callback: () => window.open('https://smartconnections.app/smart-lookup/search/?utm_source=lookup-settings-tab', '_external'),
              },
              {
                label: 'Settings documentation for Lookup Lists',
                btn_icon: 'help-circle',
                callback: () => window.open('https://smartconnections.app/smart-lookup/search/?utm_source=lookup-settings-tab#sources-vs-blocks', '_external'),
              }
            ],
            order: 1,
          },
        },
      }
    );
  }
}

/**
 * @param {{ env?: unknown }} scope
 * @returns {import('smart-types').LookupSettingsEnvLike}
 */
function get_lookup_env(scope) {
  return /** @type {import('smart-types').LookupSettingsEnvLike} */ (scope.env);
}
