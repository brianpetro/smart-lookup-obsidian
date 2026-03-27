import base from 'obsidian-smart-env/src/collections/lookup_lists.js';
import { settings_config as base_settings_config } from 'obsidian-smart-env/src/collections/lookup_lists.js';

export const settings_config = {
  ...base_settings_config,
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
