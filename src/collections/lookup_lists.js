import base from 'obsidian-smart-env/src/collections/lookup_lists.js';
import { settings_config as base_settings_config } from 'obsidian-smart-env/src/collections/lookup_lists.js';

/**
 * @typedef {import('smart-types').SettingsConfig} SettingsConfig
 * @typedef {import('obsidian-smart-env/src/collections/lookup_lists.js').LookupListsCollectionConfig} LookupListsConfig
 */

const lookup_lists = /** @type {LookupListsConfig} */ (base);
const inherited_settings_config = /** @type {SettingsConfig} */ (base_settings_config);

/** @type {SettingsConfig} */
export const settings_config = {
  ...inherited_settings_config,
  results_limit: {
    type: 'number',
    name: 'Results limit',
    description: 'Adjust the number of lookup results displayed (default 20).',
    scope_class: 'pro-setting',
  },
};

lookup_lists.settings_config = settings_config;
lookup_lists.version = 2;

export default lookup_lists;
