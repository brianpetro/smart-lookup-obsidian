import styles_css from './item_view.css';
import { create_debounced_submit, sanitize_query } from '../../utils/lookup_query_utils.js';
import {
  build_lookup_list_menu,
  show_menu,
} from './v3/list.js';

// Supersede presenter registrations bundled before the retrieval boundary was closed.
export const version = '3.1.11';

const REQUIRED_MESSAGE = 'Enter a lookup query to continue.';
const PLACEHOLDER = 'Describe the idea, topic, or question you want to explore…';
const INFO = 'Use semantic (embeddings) search to surface relevant notes. Results are sorted by similarity to your query. Note: returns different results than lexical (keyword) search.';
const AUTO_SUBMIT_LABEL = 'Auto-submit';
const AUTO_SUBMIT_INFO = 'Automatically run lookup after you pause typing. Turn off to submit manually.';
const SUBMIT_LABEL = 'Lookup';
const MODEL_LOADING_MESSAGE = 'Loading the embedding model. This lookup will run automatically when it is ready.';
const QUERYING_MESSAGE = 'Querying...';
const LOOKUP_ERROR_MESSAGE = 'Lookup failed. Submit the lookup again to retry.';
const NO_RETAINED_RESULTS_MESSAGE = 'No retained results for this query. Use Refresh to run this lookup.';

/**
 * @this {import('jsbrains/smart-types').LookupComponentRenderer}
 * @param {import('jsbrains/smart-types').LookupView} view
 * @param {import('jsbrains/smart-types').LookupComponentParams} [params={}]
 */
export async function build_html(view, params = {}) {
  const auto_submit_checked = params.auto_submit === false ? '' : 'checked';
  const menu_icon = this.get_icon_html('menu');

  const hyde_button = view.env.config?.actions?.lookup_list_generate_hyde
    ? '<button class="lookup-hyde-submit" type="button" title="Send bounded TopK query excerpts to the configured chat model and search with a generated hypothetical document.">Generate HyDE</button>'
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
        >${menu_icon}</button>
        <button
          class="clickable-icon"
          type="button"
          aria-label="Expand all results"
          title="Expand all results"
          data-action="toggle-expanded"
          disabled
        >${this.get_icon_html('unfold-vertical')}</button>
        <button
          class="clickable-icon"
          type="button"
          aria-label="Refresh lookup"
          title="Refresh lookup (query only)"
          data-action="refresh-lookup"
          disabled
        >${this.get_icon_html('refresh-cw')}</button>
        <button
          class="clickable-icon"
          type="button"
          aria-label="Previous query"
          title="Previous query"
          data-action="history-back"
          disabled
        >${this.get_icon_html('arrow-left')}</button>
        <button
          class="clickable-icon"
          type="button"
          aria-label="Next query"
          title="Next query"
          data-action="history-forward"
          disabled
        >${this.get_icon_html('arrow-right')}</button>
      </div>
      <label class="lookup-query-label" for="lookup-query-input" title="${INFO}">Smart Lookup</label>
    </div>
    <form class="lookup-query-form" novalidate>
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
  const back_button = /** @type {HTMLButtonElement} */ (container.querySelector('[data-action="history-back"]'));
  const forward_button = /** @type {HTMLButtonElement} */ (container.querySelector('[data-action="history-forward"]'));
  const fold_button = /** @type {HTMLButtonElement} */ (container.querySelector('[data-action="toggle-expanded"]'));
  const refresh_button = /** @type {HTMLButtonElement} */ (container.querySelector('[data-action="refresh-lookup"]'));
  // History owns only navigation; LookupList owns the query and retained results.
  const history = view.query_history ??= { keys: [], index: -1 };
  const app = /** @type {import('jsbrains/smart-types').LookupApp|null} */ (
    view?.plugin?.app
    || view?.app
    || view?.env?.plugin?.app
    || view?.env?.obsidian_app
    || /** @type {Window & {app?: import('jsbrains/smart-types').LookupApp}} */ (activeWindow).app
    || null
  );
  /** @type {{
   *   last_action_key: string|null,
   *   pending_action_key: string|null,
   *   active_request_id: number,
   *   lookup_list: import('jsbrains/smart-types').LookupList|null,
   *   menu_params: import('jsbrains/smart-types').LookupComponentParams|null,
   *   expanded: boolean
   * }}
   */
  const state = {
    last_action_key: null,
    pending_action_key: null,
    active_request_id: 0,
    lookup_list: null,
    menu_params: null,
    expanded: (params.lookup_settings ?? view.env.lookup_lists.settings)?.expanded_view ?? false,
  };

  const update_toolbar_state = () => {
    back_button.disabled = history.index <= 0;
    forward_button.disabled = history.index >= history.keys.length - 1;
    fold_button.disabled = !state.menu_params?.results?.length;
    refresh_button.disabled = !state.lookup_list || !!state.pending_action_key;
    const fold_title = state.expanded ? 'Collapse all results' : 'Expand all results';
    fold_button.setAttribute('aria-label', fold_title);
    fold_button.setAttribute('title', fold_title);
    this.safe_inner_html(fold_button, this.get_icon_html(state.expanded ? 'fold-vertical' : 'unfold-vertical'));
  };

  fold_button.addEventListener('click', () => {
    if (fold_button.disabled) return;
    state.expanded = !state.expanded;
    list_container.querySelectorAll('.lookup-result').forEach((result_el) => {
      result_el.classList.toggle('sc-collapsed', !state.expanded);
    });
    update_toolbar_state();
  });

  /** @param {Event} event */
  const open_lookup_menu = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const menu = build_lookup_list_menu(state.menu_params ? state.lookup_list : null, {
      ...(state.menu_params || params),
      app,
      view,
      event,
    });
    if (!menu) return;

    if (menu.items?.length) menu.addSeparator();
    view.env.build_menu?.('lookup:item_view_list_menu', menu, view);
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
   * @param {import('jsbrains/smart-types').LookupList} lookup_list
   * @param {import('jsbrains/smart-types').LookupResult[]|null} results
   * @param {() => boolean} is_current
   */
  const render_lookup_list = async (lookup_list, results, is_current) => {
    if (!results) {
      list_container.setAttribute('aria-busy', 'false');
      this.empty(list_container);
      this.safe_inner_html(list_container, `<p role="status">${NO_RETAINED_RESULTS_MESSAGE}</p>`);
      return;
    }
    const menu_params = {
      ...params,
      query: lookup_list.data.query,
      results,
      auto_submit: auto_submit_input.checked,
      lookup_settings: {
        ...(params.lookup_settings ?? view.env.lookup_lists.settings),
        expanded_view: state.expanded,
      },
      view,
      app,
      workspace: app?.workspace,
      container,
    };
    const rendered_list = await view.env.smart_components.render_component('lookup_v3_list', lookup_list, menu_params);
    if (!is_current()) return;
    state.menu_params = menu_params;
    update_toolbar_state();
    this.empty(list_container);
    list_container.appendChild(rendered_list);
    list_container.setAttribute('aria-busy', 'false');
  };

  /**
   * @param {unknown} raw_query
   * @param {string} [action_key] - Normal/automatic submission is always query-only.
   * @param {boolean} [refresh=false] - Rerun the selected item without adding history.
   */
  const submit_query = async (raw_query, action_key = 'lookup_list_get_results_query', refresh = false) => {
    const query = sanitize_query(raw_query);
    update_query_validity({ input_el: query_input, query });
    update_submit_state({ submit_btn, query });
    if (!query) {
      ++state.active_request_id;
      state.last_action_key = null;
      state.pending_action_key = null;
      state.lookup_list = null;
      state.menu_params = null;
      sync_form_state();
      update_toolbar_state();
      render_info_state();
      return;
    }
    // Switching from Lookup to HyDE must run even for the same text. A completed
    // HyDE can be explicitly regenerated, but repeated clicks while pending do not run.
    if (query === state.lookup_list?.data.query && action_key === state.last_action_key
      && (state.pending_action_key || (!refresh && action_key !== 'lookup_list_generate_hyde'))) return;
    const request_id = ++state.active_request_id;
    const is_current = () => request_id === state.active_request_id
      && sanitize_query(query_input.value) === query;
    state.last_action_key = action_key;
    state.pending_action_key = action_key;
    state.lookup_list = null;
    state.menu_params = null;
    sync_form_state();
    update_toolbar_state();

    try {
      // Normal submissions and explicit generation never reuse a previous document.
      const retrieval_params = {
        query,
        limit: params.limit,
        results_collection_key: params.results_collection_key,
        filter: params.filter,
      };
      const selected_list = view.env.lookup_lists.get(history.keys[history.index]);
      const lookup_list = selected_list?.data.query === query
        ? selected_list
        : view.env.lookup_lists.new_item(retrieval_params)
      ;
      state.lookup_list = lookup_list;
      // A different item starts a new branch; Refresh keeps the selected key/index.
      if (history.keys[history.index] !== lookup_list.key) {
        history.keys.splice(history.index + 1);
        history.keys.push(lookup_list.key);
        history.index = history.keys.length - 1;
      }
      update_toolbar_state();
      const embed_model = view.env.smart_sources.embed_model;
      if (!embed_model.is_loaded) {
        render_model_loading_state();
        await embed_model.load_background();
        if (!is_current()) return;
        if (!embed_model.is_loaded) throw new Error('The embedding model could not be loaded.');
      }
      render_querying_state();
      // Only the UI-only Pro workflow receives lifecycle context, out of band.
      // The query action and every nested retrieval receive semantic inputs only.
      const results = action_key === 'lookup_list_generate_hyde'
        ? await lookup_list.actions[action_key](retrieval_params, { is_current })
        : await lookup_list.actions[action_key](retrieval_params)
      ;
      if (!is_current()) return;

      await render_lookup_list(lookup_list, results, is_current);
      // Retain only the final displayed results, never intermediate or stale passes.
      if (is_current()) lookup_list.results = results;
    } catch (error) {
      if (!is_current()) return;
      state.last_action_key = null;
      render_lookup_error_state();
      console.error('Lookup failed', error);
    } finally {
      if (is_current()) {
        state.pending_action_key = null;
        sync_form_state();
        update_toolbar_state();
      }
    }
  };

  const debounced_submit = create_debounced_submit(submit_query);
  this.attach_disposer(container, () => {
    ++state.active_request_id;
    debounced_submit.cancel?.();
  });

  /** @param {number} direction */
  const navigate_history = async (direction) => {
    const next_index = history.index + direction;
    if (next_index < 0 || next_index >= history.keys.length) return;
    const lookup_list = view.env.lookup_lists.get(history.keys[next_index]);
    if (!lookup_list) return;
    debounced_submit.cancel?.();
    const request_id = ++state.active_request_id;
    const is_current = () => request_id === state.active_request_id;
    history.index = next_index;
    query_input.value = lookup_list.data.query;
    state.last_action_key = null;
    state.pending_action_key = null;
    state.lookup_list = lookup_list;
    state.menu_params = null;
    sync_form_state();
    update_toolbar_state();
    render_info_state();
    try {
      // Navigation only renders retained results; it never invokes retrieval.
      await render_lookup_list(lookup_list, lookup_list.results, is_current);
    } catch (error) {
      if (!is_current()) return;
      render_lookup_error_state();
      console.error('Lookup failed', error);
    }
  };
  back_button.addEventListener('click', () => void navigate_history(-1));
  forward_button.addEventListener('click', () => void navigate_history(1));
  refresh_button.addEventListener('click', () => {
    if (refresh_button.disabled) return;
    debounced_submit.cancel?.();
    void submit_query(state.lookup_list.data.query, 'lookup_list_get_results_query', true);
  });

  query_input.addEventListener('input', () => {
    // Invalidate on edits, not just submission, so an old completion cannot resume
    // when the user changes the text and then changes it back.
    ++state.active_request_id;
    state.last_action_key = null;
    state.pending_action_key = null;
    state.lookup_list = null;
    state.menu_params = null;
    update_toolbar_state();
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

  update_toolbar_state();
  query_input.value = sanitize_query(params.query);
  sync_form_state();
  if (params.query === undefined && history.index >= 0) void navigate_history(0);
  else if (query_input.value) void submit_query(query_input.value);
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
