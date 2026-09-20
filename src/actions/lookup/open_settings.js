/**
 * Open settings for the plugin that owns this Lookup view.
 *
 * @this {import('jsbrains/smart-types').LookupView}
 * @returns {Promise<boolean>}
 */
export async function lookup_open_settings() {
  await this.open_settings();
  return true;
}

export const menus = {
  'lookup:item_view_list_menu': {
    title: 'Open settings',
    icon: 'settings',
    order: 90,
  },
};
