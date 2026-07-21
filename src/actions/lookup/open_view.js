/**
 * Open the Smart Lookup view.
 *
 * @this {object}
 * @param {object} [params={}]
 * @param {object} [params.plugin]
 * @returns {boolean}
 */
export function lookup_open_view(params = {}) {
  const plugin = params.plugin;
  if (typeof plugin?.open_lookup_view !== 'function') return false;

  plugin.open_lookup_view();
  return true;
}

export const commands = {
  'smart-lookup-view': {
    name: 'Open: Lookup view',

    register_when({ plugin }) {
      return plugin.manifest.id === 'smart-lookup';
    },

    params({ plugin }) {
      return { plugin };
    },

    get_scope({ env }) {
      return env.lookup_lists;
    },
  },
};

export const ribbon_icons = {
  lookup: {
    icon_name: 'smart-lookup',
    description: 'Smart Lookup: Open lookup view',

    register_when({ plugin }) {
      return plugin.manifest.id === 'smart-lookup';
    },

    params({ plugin }) {
      return { plugin };
    },

    get_scope({ env }) {
      return env.lookup_lists;
    },
  },
};
