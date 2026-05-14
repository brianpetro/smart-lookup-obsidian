import styles_css from './styles.css';

/**
 * @typedef {import('smart-types').LookupListOptions} LookupListOptions
 * @typedef {import('smart-types').LookupListLike} LookupListLike
 * @typedef {import('smart-types').SmartViewRenderer} SmartViewLike
 */

/**
 * @param {LookupListLike} lookup_list
 * @param {LookupListOptions} _opts
 * @returns {Promise<string>}
 */
export async function build_html(lookup_list, _opts = {}) {
  return `<div class="smart-lookup-list" data-key="${escape_html_attr(lookup_list.item.key)}"></div>`;
}

/**
 * @this {SmartViewLike}
 * @param {LookupListLike} lookup_list
 * @param {LookupListOptions} opts
 * @returns {Promise<HTMLElement>}
 */
export async function render(lookup_list, opts = {}) {
  this.apply_style_sheet?.(styles_css);
  const html = await build_html(lookup_list, opts);
  const frag = this.create_doc_fragment(html);
  const container = get_first_element(frag);
  post_process.call(this, lookup_list, container, opts);
  return container;
}

/**
 * @this {SmartViewLike}
 * @param {LookupListLike} lookup_list
 * @param {HTMLElement} container
 * @param {LookupListOptions} opts
 * @returns {Promise<HTMLElement>}
 */
export async function post_process(lookup_list, container, opts = {}) {
  container.dataset.key = lookup_list.key;
  const results = await lookup_list.get_results(opts);
  if (!Array.isArray(results) || results.length === 0) {
    const no_results = activeDocument.createElement('p');
    no_results.className = 'sc-no-results';
    no_results.textContent = 'No results found';
    container.appendChild(no_results);
    return container;
  }
  const smart_components = lookup_list.env.smart_components;
  const result_frags = await Promise.all(results.map((result) => {
    return smart_components.render_component('lookup_v3_list_item', result, {
      event_key_domain: 'lookup',
      ...opts,
    });
  }));
  result_frags.forEach((result_frag) => container.appendChild(result_frag));
  return container;
}

/**
 * @param {DocumentFragment} frag
 * @returns {HTMLElement}
 */
function get_first_element(frag) {
  const element = frag.firstElementChild;
  if (element instanceof HTMLElement) return element;
  throw new Error('lookup_v3_list render failed: expected root element.');
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function escape_html_attr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  ;
}
