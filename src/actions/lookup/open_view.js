import { sanitize_query } from '../../utils/lookup_query_utils.js';

export const LOOKUP_SELECTION_COMMAND_ID = 'smart-lookup-selection';

/**
 * Open the Smart Lookup view.
 *
 * @this {object}
 * @param {import('smart-types').LookupComponentParams} [params={}]
 * @returns {boolean}
 */
export function lookup_open_view(params = {}) {
  const plugin = params.plugin;
  if (typeof plugin?.open_lookup_view !== 'function') return false;

  const query = sanitize_query(params.query);
  const event_source = params.event_source;
  const view_params = { ...params };
  delete view_params.plugin;
  delete view_params.query;
  delete view_params.event_source;

  plugin.open_lookup_view({
    ...view_params,
    ...(query ? { query } : {}),
    ...(query && event_source !== undefined
      ? { event_source }
      : {}),
  });
  return true;
}

export const commands = {
  'smart-lookup-view': {
    name: 'Open: Lookup view',

    /** @param {import('smart-types').LookupActionContext} context */
    register_when({ plugin }) {
      return plugin.manifest.id === 'smart-lookup';
    },

    /** @param {import('smart-types').LookupActionContext} context */
    params({ plugin }) {
      return { plugin };
    },

    /** @param {import('smart-types').LookupActionContext} context */
    get_scope({ env }) {
      return env.lookup_lists;
    },
  },

  [LOOKUP_SELECTION_COMMAND_ID]: {
    name: 'Search selection with Smart Lookup',
    context: 'editor',

    /** @param {import('smart-types').LookupActionContext} context */
    register_when({ plugin }) {
      return plugin.manifest.id === 'smart-lookup';
    },

    /** @param {import('smart-types').LookupActionContext} context */
    params({ plugin, editor }) {
      return {
        plugin,
        query: sanitize_query(editor?.getSelection?.()),
      };
    },

    /** @param {import('smart-types').LookupActionContext} context */
    get_scope({ env }) {
      return env.lookup_lists;
    },

    /** @param {import('smart-types').LookupActionContext} context */
    when({ params }) {
      return Boolean(params.query);
    },
  },
};

export const menus = {
  'lookup:editor_menu': {
    title: 'Search selection with Smart Lookup',
    icon: 'smart-lookup',

    /** @param {import('smart-types').LookupActionContext} context */
    when({ params }) {
      return Boolean(params.query);
    },
  },
};

export const ribbon_icons = {
  lookup: {
    icon_name: 'smart-lookup',
    description: 'Smart Lookup: Open lookup view',

    /** @param {import('smart-types').LookupActionContext} context */
    register_when({ plugin }) {
      return plugin.manifest.id === 'smart-lookup';
    },

    /** @param {import('smart-types').LookupActionContext} context */
    params({ plugin }) {
      return { plugin };
    },

    /** @param {import('smart-types').LookupActionContext} context */
    get_scope({ env }) {
      return env.lookup_lists;
    },
  },
};
