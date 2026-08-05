import { Menu } from 'obsidian';
import styles_css from './styles.css';

/** @typedef {HTMLElement & {_lookup_list_menu_registered?: boolean}} LookupListElement */

/**
 * @param {import('smart-types').LookupList} lookup_list
 * @param {import('smart-types').LookupComponentParams} [opts={}]
 */
export async function build_html(lookup_list, opts = {}) {
  const lookup_key = lookup_list?.key || lookup_list?.item?.key || '';
  return `<div class="smart-lookup-list" data-key="${lookup_key}"></div>`;
}

/**
 * @this {import('smart-types').LookupComponentRenderer}
 * @param {import('smart-types').LookupList} lookup_list
 * @param {import('smart-types').LookupComponentParams} [opts={}]
 */
export async function render(lookup_list, opts = {}) {
  this.apply_style_sheet(styles_css);
  const html = await build_html.call(this, lookup_list, opts);
  const frag = this.create_doc_fragment(html);
  const container = /** @type {LookupListElement} */ (frag.firstElementChild);
  post_process.call(this, lookup_list, container, opts);
  return container;
}

/**
 * @this {import('smart-types').LookupComponentRenderer}
 * @param {import('smart-types').LookupList} lookup_list
 * @param {LookupListElement} container
 * @param {import('smart-types').LookupComponentParams} [opts={}]
 */
export async function post_process(lookup_list, container, opts = {}) {
  container.dataset.key = lookup_list.key;
  const results = Array.isArray(opts.results)
    ? opts.results
    : await lookup_list.actions.lookup_list_get_results(opts)
  ;
  const menu_params = {
    ...opts,
    results,
    lookup_list,
  };
  register_lookup_list_menu(lookup_list, container, menu_params);
  if(!results || !Array.isArray(results) || results.length === 0) {
    const no_results = this.create_doc_fragment('<p class="sc-no-results">No results found</p>');
    container.appendChild(no_results);
    return container;
  }
  const smart_components = lookup_list.env.smart_components;
  const result_frags = await Promise.all(results.map((result) => {
    return smart_components.render_component('lookup_v3_list_item', result, {
      event_key_domain: 'lookup',
      ...menu_params
    });
  }));
  result_frags.forEach((result_frag) => container.appendChild(result_frag));
  return container;
}

/**
 * @param {import('smart-types').LookupList} lookup_list
 * @param {LookupListElement} container
 * @param {import('smart-types').LookupComponentParams} [params={}]
 */
function register_lookup_list_menu(lookup_list, container, params = {}) {
  if (container._lookup_list_menu_registered) return;
  container._lookup_list_menu_registered = true;

  container.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    event.stopPropagation();

    const menu = build_lookup_list_menu(lookup_list, {
      ...params,
      event,
    });
    if (!menu) return;

    show_menu(menu, event, container);
  });
}

/**
 * @param {import('smart-types').LookupList} lookup_list
 * @param {import('smart-types').LookupComponentParams} [params={}]
 * @returns {Menu|null}
 */
export function build_lookup_list_menu(lookup_list, params = {}) {
  const app = get_lookup_app(lookup_list, params);
  if (!app) return null;

  const menu = new Menu(app);
  lookup_list?.env?.build_menu?.('lookup:list_menu', menu, lookup_list, params);
  return menu;
}

/**
 * @param {import('smart-types').LookupList} lookup_list
 * @param {import('smart-types').LookupComponentParams} [params={}]
 * @returns {import('obsidian').App|null}
 */
function get_lookup_app(lookup_list, params = {}) {
  const env = lookup_list?.env;
  return /** @type {import('obsidian').App|null} */ (
    params.app
    || params.view?.plugin?.app
    || params.view?.app
    || env?.smart_lookup_plugin?.app
    || env?.plugin?.app
    || env?.main?.app
    || env?.obsidian_app
    || /** @type {Window & {app?: import('obsidian').App}} */ (activeWindow).app
    || null
  );
}

/**
 * @param {Menu} menu
 * @param {Event} event
 * @param {HTMLElement} anchor_el
 */
export function show_menu(menu, event, anchor_el) {
  if (
    event?.type === 'contextmenu'
    && typeof MouseEvent !== 'undefined'
    && event instanceof MouseEvent
  ) {
    menu.showAtMouseEvent(event);
    return;
  }

  const rect = anchor_el.getBoundingClientRect();
  if (typeof menu.showAtPosition === 'function') {
    menu.showAtPosition({ x: rect.left, y: rect.bottom });
    return;
  }

  menu.showAtMouseEvent(new MouseEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
    clientX: rect.left,
    clientY: rect.bottom,
  }));
}

