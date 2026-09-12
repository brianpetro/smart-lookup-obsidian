import styles_css from './item_view.css';
import { create_debounced_submit, sanitize_query } from '../../utils/lookup_query_utils.js';
import {
  build_lookup_list_menu,
  show_menu,
} from './v3/list.js';

const REQUIRED_MESSAGE = 'Enter a lookup query to continue.';
const PLACEHOLDER = 'Describe the idea, topic, or question you want to explore…';
const INFO = 'Use semantic (embeddings) search to surface relevant notes. Results are sorted by similarity to your query. Note: returns different results than lexical (keyword) search.';
const AUTO_SUBMIT_LABEL = 'Auto-submit';
const AUTO_SUBMIT_INFO = 'Automatically run lookup after you pause typing. Turn off to submit manually.';
const SUBMIT_LABEL = 'Lookup';
const MODEL_LOADING_MESSAGE = 'Loading the embedding model. This lookup will run automatically when it is ready.';
const QUERYING_MESSAGE = 'Querying...';
const LOOKUP_ERROR_MESSAGE = 'Lookup failed. Submit the lookup again to retry.';

/**
 * @this {import('jsbrains/smart-types').LookupComponentRenderer}
 * @param {import('jsbrains/smart-types').LookupView} view
 * @param {import('jsbrains/smart-types').LookupComponentParams} [params={}]
 */
export async function build_html(view, params = {}) {
  const auto_submit_checked = params.auto_submit === false ? '' : 'checked';
  const menu_icon = typeof this.get_icon_html === 'function'
    ? this.get_icon_html('menu')
    : ''
  ;

  const hyde_button = view.env.config?.actions?.lookup_list_generate_hyde
    ? '<button class="lookup-hyde-submit" type="button" title="Send bounded TopK query excerpts to the configured chat model and search with a generated hypothetical document.">HyDE</button>'
    : ''
  ;

  return `<div><div class="lookup-item-view">
    <div class="lookup-top-bar">
      <div class="lookup-actions">
        <button
          class="clickable-icon lookup-menu-button"
          type="button"
          aria-label="More actions"
          data-action="open-menu"
          disabled
        >${menu_icon}</button>
      </div>
    </div>
    <form class="lookup-query-form" novalidate>
      <label class="lookup-query-label" for="lookup-query-input" title="${INFO}">Smart Lookup</label>
      <textarea
        class="lookup-query-input"
        id="lookup-query-input"
        name="lookup-query"
        rows="4"
        placeholder="${PLACEHOLDER}"
        required
      ></textarea>
      <div class="lookup-query-controls">
        <label class="lookup-query-toggle" title="${AUTO_SUBMIT_INFO}">
          <input
            class="lookup-query-auto-submit"
            type="checkbox"
            name="lookup-auto-submit"
            ${auto_submit_checked}
          />
          <span>${AUTO_SUBMIT_LABEL}</span>
        </label>
        <button class="mod-cta lookup-query-submit" type="submit">${SUBMIT_LABEL}</button>
        ${hyde_button}
      </div>
    </form>
    <div class="smart-lookup-list-container">
      <p>${INFO}</p>
    </div>
  </div></div>`;
}

/**
 * @this {import('jsbrains/smart-types').LookupComponentRenderer}
 * @param {import('jsbrains/smart-types').LookupView} view
 * @param {import('jsbrains/smart-types').LookupComponentParams} [params={}]
 */
export async function render(view, params = {}) {
  this.apply_style_sheet(styles_css);
  const html = await build_html.call(this, view, params);
  const frag = this.create_doc_fragment(html);
  const container = /** @type {HTMLElement} */ (frag.querySelector('.lookup-item-view'));
  post_process.call(this, view, container, params);
  return container;
}

/**
 * @this {import('jsbrains/smart-types').LookupComponentRenderer}
 * @param {import('jsbrains/smart-types').LookupView} view
 * @param {HTMLElement} container
 * @param {import('jsbrains/smart-types').LookupComponentParams} [params={}]
 */
export async function post_process(view, container, params = {}) {
  const query_input = /** @type {HTMLTextAreaElement} */ (container.querySelector('.lookup-query-input'));
  const query_form = /** @type {HTMLFormElement} */ (container.querySelector('.lookup-query-form'));
  const auto_submit_input = /** @type {HTMLInputElement} */ (container.querySelector('.lookup-query-auto-submit'));
  const submit_btn = /** @type {HTMLButtonElement} */ (container.querySelector('.lookup-query-submit'));
  const hyde_btn = /** @type {HTMLButtonElement|null} */ (container.querySelector('.lookup-hyde-submit'));
  const menu_button = /** @type {HTMLButtonElement} */ (container.querySelector('[data-action="open-menu"]'));
  const list_container = /** @type {HTMLElement} */ (container.querySelector('.smart-lookup-list-container'));
  const app = /** @type {import('jsbrains/smart-types').LookupApp|null} */ (
    view?.plugin?.app
    || view?.app
    || view?.env?.plugin?.app
    || view?.env?.obsidian_app
    || /** @type {Window & {app?: import('jsbrains/smart-types').LookupApp}} */ (activeWindow).app
    || null
  );
  /** @type {{
   *   last_query: string|null,
   *   last_action_key: string|null,
   *   pending_action_key: string|null,
   *   active_request_id: number,
   *   lookup_list: import('jsbrains/smart-types').LookupList|null,
   *   menu_params: import('jsbrains/smart-types').LookupComponentParams|null
   * }}
   */
  const state = {
    last_query: null,
    last_action_key: null,
    pending_action_key: null,
    active_request_id: 0,
    lookup_list: null,
    menu_params: null,
  };

  const update_menu_state = () => {
    if (!menu_button) return;
    menu_button.disabled = !state.lookup_list;
  };

  /** @param {Event} event */
  const open_lookup_menu = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!state.lookup_list) return;

    const menu = build_lookup_list_menu(state.lookup_list, {
      ...(state.menu_params || params),
      event,
    });
    if (!menu) return;

    show_menu(menu, event, menu_button);
  };

  menu_button?.addEventListener('click', open_lookup_menu);
  menu_button?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    open_lookup_menu(event);
  });

  const render_info_state = () => {
    list_container.setAttribute('aria-busy', 'false');
    this.empty(list_container);
    this.safe_inner_html(list_container, `<p>${INFO}</p>`);
  };

  const render_model_loading_state = () => {
    list_container.setAttribute('aria-busy', 'true');
    this.empty(list_container);
    this.safe_inner_html(list_container, `<div class="lookup-query-status" role="status" aria-live="polite">
      <progress aria-hidden="true"></progress>
      <span>${MODEL_LOADING_MESSAGE}</span>
    </div>`);
  };

  const render_querying_state = () => {
    list_container.setAttribute('aria-busy', 'true');
    this.empty(list_container);
    this.safe_inner_html(list_container, `<div class="lookup-query-status" role="status" aria-live="polite">
      <progress aria-hidden="true"></progress>
      <span>${QUERYING_MESSAGE}</span>
    </div>`);
  };

  const render_lookup_error_state = () => {
    list_container.setAttribute('aria-busy', 'false');
    this.empty(list_container);
    this.safe_inner_html(list_container, `<p role="alert">${LOOKUP_ERROR_MESSAGE}</p>`);
  };

  const sync_form_state = () => {
    const query = sanitize_query(query_input.value);
    update_query_validity({ input_el: query_input, query });
    update_submit_state({ submit_btn, query });
    if (hyde_btn) hyde_btn.disabled = !query || state.pending_action_key === 'lookup_list_generate_hyde';
    return query;
  };

  /**
   * @param {unknown} raw_query
   * @param {string} [action_key] - Normal/automatic submission is always query-only.
   */
  const submit_query = async (raw_query, action_key = 'lookup_list_get_results_query') => {
    const query = sanitize_query(raw_query);
    update_query_validity({ input_el: query_input, query });
    update_submit_state({ submit_btn, query });
    if (!query) {
      ++state.active_request_id;
      state.last_query = null;
      state.pending_action_key = null;
      state.lookup_list = null;
      state.menu_params = null;
      sync_form_state();
      update_menu_state();
      render_info_state();
      return;
    }
    // Switching from Lookup to HyDE must run even for the same text. A completed
    // HyDE can be explicitly regenerated, but repeated clicks while pending do not run.
    if (query === state.last_query && action_key === state.last_action_key
      && (state.pending_action_key || action_key !== 'lookup_list_generate_hyde')) return;
    const request_id = ++state.active_request_id;
    const is_current = () => request_id === state.active_request_id
      && sanitize_query(query_input.value) === query;
    state.last_query = query;
    state.last_action_key = action_key;
    state.pending_action_key = action_key;
    state.lookup_list = null;
    state.menu_params = null;
    sync_form_state();
    update_menu_state();
    /** @type {import('jsbrains/smart-types').LookupComponentParams} */
    const next_params = {
      ...params,
      query,
      is_current,
      auto_submit: auto_submit_input.checked,
      view,
      app,
      workspace: app?.workspace,
      container,
    };

    try {
      const embed_model = view.env.smart_sources.embed_model;
      if (!embed_model.is_loaded) {
        render_model_loading_state();
        await embed_model.load_background();
        if (!is_current()) return;
        if (!embed_model.is_loaded) throw new Error('The embedding model could not be loaded.');
      }
      const lookup_list = view.env.lookup_lists.new_item(next_params);
      render_querying_state();
      const results = await lookup_list.actions[action_key](next_params);
      if (!is_current()) return;

      const menu_params = { ...next_params, results };
      const rendered_list = await view.env.smart_components.render_component('lookup_v3_list', lookup_list, menu_params);
      if (!is_current()) return;
      state.lookup_list = lookup_list;
      state.menu_params = menu_params;
      update_menu_state();
      this.empty(list_container);
      list_container.appendChild(rendered_list);
      list_container.setAttribute('aria-busy', 'false');
    } catch (error) {
      if (!is_current()) return;
      state.last_query = null;
      render_lookup_error_state();
      console.error('Lookup failed', error);
    } finally {
      if (is_current()) {
        state.pending_action_key = null;
        sync_form_state();
      }
    }
  };

  const debounced_submit = create_debounced_submit(submit_query);

  query_input.addEventListener('input', () => {
    // Invalidate on edits, not just submission, so an old completion cannot resume
    // when the user changes the text and then changes it back.
    ++state.active_request_id;
    state.last_query = null;
    state.pending_action_key = null;
    state.lookup_list = null;
    state.menu_params = null;
    update_menu_state();
    render_info_state();
    const query = sync_form_state();
    if (!query) {
      debounced_submit.cancel?.();
      submit_query(query);
      return;
    }
    if (!auto_submit_input.checked) {
      debounced_submit.cancel?.();
      return;
    }
    debounced_submit(query);
  });

  auto_submit_input.addEventListener('change', () => {
    const query = sync_form_state();
    if (!auto_submit_input.checked) {
      debounced_submit.cancel?.();
      return;
    }
    if (query) debounced_submit(query);
  });

  query_form.addEventListener('submit', (event) => {
    event.preventDefault();
    const query = sync_form_state();
    debounced_submit.cancel?.();
    submit_query(query);
  });

  hyde_btn?.addEventListener('click', () => {
    const query = sync_form_state();
    debounced_submit.cancel?.();
    void submit_query(query, 'lookup_list_generate_hyde');
  });

  update_menu_state();
  const initial_query = sanitize_query(params.query);
  query_input.value = initial_query;
  sync_form_state();
  if (initial_query) void submit_query(initial_query);
  return container;
}

/** @param {{input_el: HTMLTextAreaElement, query: string}} state */
export function update_query_validity({ input_el, query }) {
  if (!input_el?.setCustomValidity) return;
  if (!query) input_el.setCustomValidity(REQUIRED_MESSAGE);
  else input_el.setCustomValidity('');
}

/** @param {{submit_btn: HTMLButtonElement, query: string}} state */
export function update_submit_state({ submit_btn, query }) {
  if (!submit_btn) return;
  submit_btn.disabled = !query;
}
