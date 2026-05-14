import { SmartPluginSettingsTab } from 'obsidian-smart-env';
import { render_settings_config as raw_render_settings_config } from 'obsidian-smart-env/src/utils/render_settings_config.js';

/**
 * @typedef {import('smart-types').SettingsConfig} SettingsConfig
 * @typedef {import('smart-types').LookupListsCollectionLike} LookupListsLike
 * @typedef {import('obsidian-smart-env').SmartEnv} SmartEnvBase
 * @typedef {import('obsidian-smart-env').ObsidianHTMLElement} ObsidianContainerEl
 */

/**
 * @typedef {SmartEnvBase & {
 *   lookup_lists: LookupListsLike,
 *   config: { collections: { lookup_lists: { settings_config: SettingsConfig } } },
 * }} LookupSettingsEnv
 */

/**
 * @typedef {object} RenderSettingsParams
 * @property {string} [default_group_name]
 * @property {Record<string, unknown>} [group_params]
 */

const render_settings_config = /** @type {(settings_config: (() => SettingsConfig), scope: LookupListsLike, container: HTMLElement, params?: RenderSettingsParams) => unknown} */ (raw_render_settings_config);

export class SmartLookupSettingsTab extends SmartPluginSettingsTab {

  /**
   * @param {ObsidianContainerEl|null|undefined} container
   * @returns {Promise<void>}
   */
  async render_plugin_settings(container) {
    if (!container) return;
    container.empty?.();

    const env = /** @type {LookupSettingsEnv} */ (this);
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
