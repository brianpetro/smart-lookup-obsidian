import base_config from 'obsidian-smart-env/src/collections/lookup_lists.js';
import { settings_config as base_settings_config } from 'obsidian-smart-env/src/collections/lookup_lists.js';

const base = /** @type {import('smart-types').SmartEnvCollectionConfig} */ (base_config);
const inherited_settings_config = /** @type {import('smart-types').SettingsConfig} */ (base_settings_config);

/** @type {import('smart-types').SettingsConfig} */
export const settings_config = {
  ...inherited_settings_config,
  results_limit: {
    type: 'number',
    name: 'Results limit',
    description: 'Adjust the number of lookup results displayed (default 20).',
    scope_class: 'pro-setting',
  },
};

base.settings_config = settings_config;
base.version = 2;

export default base;
