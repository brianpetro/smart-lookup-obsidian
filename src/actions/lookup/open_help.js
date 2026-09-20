/**
 * Open the Smart Lookup getting started guide.
 *
 * @returns {boolean}
 */
export function lookup_open_help() {
  activeWindow.open('https://smartconnections.app/smart-lookup/getting-started/', '_external');
  return true;
}

export const menus = {
  'lookup:item_view_list_menu': {
    title: 'Help',
    icon: 'help-circle',
    order: 100,
  },
};
