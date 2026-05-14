import shared_eslint_config from "../obsidian-smart-env/eslint.base.mjs";

const shared_configs = Array.isArray(shared_eslint_config)
  ? shared_eslint_config
  : [shared_eslint_config]
;

export default [
  {
    ignores: [
      'smart_env.config.js',
      'index.js',
    ],
  },
  ...shared_configs,
];
