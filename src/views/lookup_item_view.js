import { SmartItemView } from 'obsidian-smart-env/views/smart_item_view.js';

/**
 * @typedef {import('obsidian-smart-env').ObsidianHTMLElement} ObsidianContainerEl
 */

export class LookupItemView extends SmartItemView {
  static get view_type() { return 'smart-lookup-view'; }
  static get display_text() { return 'Lookup'; }
  static get icon_name() { return 'smart-lookup'; }

  /**
   * @param {Record<string, unknown>} [lookup_params]
   * @param {ObsidianContainerEl|null} [container]
   * @returns {Promise<void>}
   */
  async render_view(lookup_params = {}, container = null) {
    const env = get_lookup_env(this);
    const target_container = container || get_view_container(this);
    const frag = await env.smart_components.render_component('lookup_item_view', this, lookup_params);
    empty_container(target_container);
    target_container.appendChild(frag);
  }
}

/**
 * @param {{ env?: unknown }} view
 * @returns {import('smart-types').LookupItemViewEnvLike}
 */
function get_lookup_env(view) {
  return /** @type {import('smart-types').LookupItemViewEnvLike} */ (view.env);
}

/**
 * @param {{ container?: unknown }} view
 * @returns {ObsidianContainerEl}
 */
function get_view_container(view) {
  const container = view.container;
  if (!(container instanceof HTMLElement)) {
    throw new Error('LookupItemView expected an HTMLElement container.');
  }
  return /** @type {ObsidianContainerEl} */ (container);
}

/**
 * @param {ObsidianContainerEl} container
 * @returns {void}
 */
function empty_container(container) {
  if (typeof container.empty === 'function') {
    container.empty();
    return;
  }
  container.replaceChildren();
}
