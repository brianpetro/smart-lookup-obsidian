export const SMART_CONTEXT_URL = 'https://smartconnections.app/smart-context/';

/**
 * Open Smart Context information when Smart Context Pro is not installed.
 *
 * Smart Context Pro replaces this placeholder with an actual context action via
 * its own `lookup:list_menu` menu action.
 *
 * @this {object}
 */
export function lookup_list_send_to_smart_context() {
  if (this?.env?.event_logs?.settings?.native_notice_attention) {
    this?.env?.events?.emit?.('lookup:smart_context_link_unavailable', {
      level: 'attention',
      message: 'Smart Context plugin is required.',
      event_source: 'lookup_list_send_to_smart_context',
      link: SMART_CONTEXT_URL,
      hide_mute_button: true,
    });
    return true;
  }

  const open_url = globalThis.activeWindow?.open
    || globalThis.window?.open
    || globalThis.open
  ;
  if (typeof open_url !== 'function') return false;

  open_url(SMART_CONTEXT_URL, '_external');
  return true;
}

export const menus = {
  'lookup:list_menu': {
    title: 'Open in Context Builder',
    icon: 'smart-context-builder',
    order: 30,
  },
};

export const version = '0.0.1';

