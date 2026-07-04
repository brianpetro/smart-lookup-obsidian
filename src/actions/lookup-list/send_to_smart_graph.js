export const SMART_GRAPH_URL = 'https://smartconnections.app/smart-graph/';

/**
 * Open Smart Graph information when Smart Graph Pro is not installed.
 *
 * Smart Graph Pro replaces this placeholder with an actual graph action via
 * its own `lookup:list_menu` menu action.
 *
 * @this {object}
 */
export function lookup_list_send_to_smart_graph() {
  if (this?.env?.event_logs?.settings?.native_notice_attention) {
    this?.env?.events?.emit?.('lookup:smart_graph_link_unavailable', {
      level: 'attention',
      message: 'Smart Graph plugin is required.',
      event_source: 'lookup_list_send_to_smart_graph',
      link: SMART_GRAPH_URL,
      hide_mute_button: true,
    });
    return true;
  }

  const open_url = globalThis.activeWindow?.open
    || globalThis.window?.open
    || globalThis.open
  ;
  if (typeof open_url !== 'function') return false;

  open_url(SMART_GRAPH_URL, '_external');
  return true;
}

export const menus = {
  'lookup:list_menu': {
    title: 'Explore in Smart Graph',
    icon: 'smart-graph',
    order: 30,
  },
};

export const version = '0.0.1';

