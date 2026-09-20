import test from 'ava';
import { build_menu } from 'obsidian-smart-env/src/utils/menu_actions.js';
import { lookup_open_help, menus as help_menus } from '../../actions/lookup/open_help.js';
import { lookup_open_settings, menus as settings_menus } from '../../actions/lookup/open_settings.js';
import { project_lookup_list_request } from 'obsidian-smart-env/src/actions/lookup-list/get_results.js';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

function load_post_process(export_name = 'post_process', file_name = 'item_view.js', overrides = {}) {
  const dir_name = path.dirname(fileURLToPath(import.meta.url));
  const file_path = path.join(dir_name, file_name);
  const full_source = fs.readFileSync(file_path, 'utf8');
  const source_start = full_source.indexOf(file_name === 'item_view.js' ? 'const REQUIRED_MESSAGE' : '/** @typedef');
  if (source_start === -1) {
    throw new Error('Lookup presenter module body not found.');
  }

  const source = full_source
    .slice(source_start)
    .replace(/\bexport\s+(?=(?:async\s+)?function)/g, '')
    .concat('\nmodule.exports = { post_process, build_html, build_lookup_list_menu };\n')
  ;
  const context = vm.createContext({
    module: { exports: {} },
    exports: {},
    activeWindow: {},
    console: {
      error() {},
    },
    create_debounced_submit(callback) {
      const submit = (value) => callback(value);
      submit.cancel = () => {};
      return submit;
    },
    sanitize_query(value) {
      return typeof value === 'string' ? value.trim() : '';
    },
    build_lookup_list_menu() {
      return null;
    },
    show_menu() {},
    ...overrides,
  });

  const script = new vm.Script(source, { filename: file_path });
  script.runInContext(context);
  return context.module.exports[export_name];
}

function create_element() {
  const selectors = new Map();
  const listeners = new Map();
  const classes = new Set();
  return {
    attributes: {},
    dataset: {},
    checked: false,
    classList: {
      contains(name) { return classes.has(name); },
      toggle(name, enabled) {
        if (enabled) classes.add(name);
        else classes.delete(name);
      },
    },
    children: [],
    disabled: false,
    inner_html: '',
    validation_message: '',
    value: '',
    addEventListener(event_key, callback) {
      if (!listeners.has(event_key)) listeners.set(event_key, []);
      listeners.get(event_key).push(callback);
    },
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    dispatch(event_key, event = {}) {
      for (const callback of listeners.get(event_key) || []) {
        callback(event);
      }
    },
    querySelector(selector) {
      return selectors.get(selector) || null;
    },
    querySelectorAll(selector) {
      return selectors.get(selector) || [];
    },
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    },
    setCustomValidity(message) {
      this.validation_message = message;
    },
    set_selector(selector, element) {
      selectors.set(selector, element);
      return element;
    },
  };
}

function create_lookup_view_elements({ pro = false } = {}) {
  const container = create_element();
  const query_input = container.set_selector('.lookup-query-input', create_element());
  const query_form = container.set_selector('.lookup-query-form', create_element());
  const auto_submit_input = container.set_selector('.lookup-query-auto-submit', create_element());
  const submit_btn = container.set_selector('.lookup-query-submit', create_element());
  const hyde_btn = pro ? container.set_selector('.lookup-hyde-submit', create_element()) : null;
  const menu_button = container.set_selector('[data-action="open-menu"]', create_element());
  const list_container = container.set_selector('.smart-lookup-list-container', create_element());
  const back_button = container.set_selector('[data-action="history-back"]', create_element());
  const forward_button = container.set_selector('[data-action="history-forward"]', create_element());
  const fold_button = container.set_selector('[data-action="toggle-expanded"]', create_element());
  const refresh_button = container.set_selector('[data-action="refresh-lookup"]', create_element());

  auto_submit_input.checked = false;
  return {
    auto_submit_input,
    back_button,
    forward_button,
    fold_button,
    refresh_button,
    container,
    list_container,
    menu_button,
    query_form,
    query_input,
    submit_btn,
    hyde_btn,
  };
}

function create_component() {
  return {
    get_icon_html(icon_name) {
      return `<svg data-icon="${icon_name}"></svg>`;
    },
    attach_disposer(element, dispose) {
      element.dispose = dispose;
    },
    empty(element) {
      element.children = [];
      element.inner_html = '';
    },
    safe_inner_html(element, html) {
      element.inner_html = html;
    },
  };
}

function create_deferred() {
  let resolve;
  const promise = new Promise((resolve_promise) => {
    resolve = resolve_promise;
  });
  return { promise, resolve };
}

async function flush_async() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

test('Lookup view shows querying status until the results action resolves', async (t) => {
  const post_process = load_post_process();
  const elements = create_lookup_view_elements();
  const results_deferred = create_deferred();
  const rendered_list = create_element();
  const results = [{ item: { key: 'notes/example.md' }, score: 0.9 }];
  const action_calls = [];
  let render_params;
  const lookup_list = {
    key: 'lookup',
    data: {},
    results: null,
    actions: {
      lookup_list_get_results_query(params) {
        action_calls.push(params);
        return results_deferred.promise;
      },
    },
  };
  const view = {
    env: {
      lookup_lists: {
        get() {},
        new_item({ query }) {
          lookup_list.data.query = query;
          return lookup_list;
        },
      },
      smart_components: {
        async render_component(component_key, item, params) {
          t.is(component_key, 'lookup_v3_list');
          t.is(item, lookup_list);
          render_params = params;
          return rendered_list;
        },
      },
      smart_sources: {
        embed_model: {
          is_loaded: true,
        },
      },
    },
  };

  await post_process.call(create_component(), view, elements.container);
  elements.query_input.value = 'inspect this query';
  elements.query_form.dispatch('submit', {
    preventDefault() {},
  });

  t.is(action_calls.length, 1);
  t.is(action_calls[0].query, 'inspect this query');
  t.is(elements.list_container.attributes['aria-busy'], 'true');
  t.true(elements.list_container.inner_html.includes('class="lookup-query-status"'));
  t.true(elements.list_container.inner_html.includes('Querying...'));
  t.false(elements.menu_button.disabled);
  t.true(elements.fold_button.disabled);

  results_deferred.resolve(results);
  await flush_async();

  t.is(elements.list_container.attributes['aria-busy'], 'false');
  t.deepEqual(elements.list_container.children, [rendered_list]);
  t.is(render_params.results, results);
  t.is(lookup_list.results, results);
  t.false(Object.hasOwn(lookup_list.data, 'results'));
  t.false(elements.menu_button.disabled);
});

test('Lookup view clears querying status and permits retry when the action fails', async (t) => {
  const post_process = load_post_process();
  const elements = create_lookup_view_elements();
  const retry_deferred = create_deferred();
  let action_calls = 0;
  const lookup_list = {
    key: 'lookup',
    data: {},
    results: null,
    actions: {
      lookup_list_get_results_query() {
        action_calls += 1;
        if (action_calls === 1) {
          return Promise.reject(new Error('Lookup unavailable'));
        }
        return retry_deferred.promise;
      },
    },
  };
  const view = {
    env: {
      lookup_lists: {
        get() {},
        new_item({ query }) {
          lookup_list.data.query = query;
          return lookup_list;
        },
      },
      smart_components: {
        async render_component() {
          return create_element();
        },
      },
      smart_sources: {
        embed_model: {
          is_loaded: true,
        },
      },
    },
  };

  await post_process.call(create_component(), view, elements.container);
  elements.query_input.value = 'retry this query';
  elements.query_form.dispatch('submit', {
    preventDefault() {},
  });

  t.true(elements.list_container.inner_html.includes('Querying...'));
  await flush_async();

  t.is(elements.list_container.attributes['aria-busy'], 'false');
  t.true(elements.list_container.inner_html.includes('role="alert"'));
  t.true(elements.list_container.inner_html.includes('Submit the lookup again to retry.'));
  t.false(elements.menu_button.disabled);
  t.true(elements.fold_button.disabled);

  elements.query_form.dispatch('submit', {
    preventDefault() {},
  });

  t.is(action_calls, 2);
  t.is(elements.list_container.attributes['aria-busy'], 'true');
  t.true(elements.list_container.inner_html.includes('Querying...'));

  retry_deferred.resolve([]);
  await flush_async();
});

test('Lookup view submits an initial query supplied by an opening action', async (t) => {
  const post_process = load_post_process();
  const elements = create_lookup_view_elements();
  const results_deferred = create_deferred();
  const rendered_list = create_element();
  const action_calls = [];
  const new_item_calls = [];
  let render_params;
  const lookup_list = {
    key: 'lookup',
    data: {},
    results: null,
    actions: {
      lookup_list_get_results_query(params) {
        action_calls.push(params);
        return results_deferred.promise;
      },
    },
  };
  const view = {
    env: {
      lookup_lists: {
        get() {},
        new_item(params) {
          lookup_list.data.query = params.query;
          new_item_calls.push(params);
          return lookup_list;
        },
      },
      smart_components: {
        async render_component(component_key, item, params) {
          render_params = params;
          return rendered_list;
        },
      },
      smart_sources: {
        embed_model: {
          is_loaded: true,
        },
      },
    },
  };

  await post_process.call(
    create_component(),
    view,
    elements.container,
    {
      event_source: 'command:smart-lookup:smart-lookup-selection',
      query: '  highlighted text  ',
    },
  );

  t.is(elements.query_input.value, 'highlighted text');
  t.is(elements.query_input.validation_message, '');
  t.false(elements.submit_btn.disabled);
  t.is(new_item_calls.length, 1);
  t.is(new_item_calls[0].query, 'highlighted text');
  t.is(action_calls.length, 1);
  t.is(action_calls[0].query, 'highlighted text');
  t.false(Object.hasOwn(action_calls[0], 'event_source'));
  t.false(Object.hasOwn(new_item_calls[0], 'event_source'));
  t.true(elements.list_container.inner_html.includes('Querying...'));

  results_deferred.resolve([]);
  await flush_async();

  t.deepEqual(elements.list_container.children, [rendered_list]);
  t.is(elements.list_container.attributes['aria-busy'], 'false');
  t.is(render_params.event_source, 'command:smart-lookup:smart-lookup-selection');
});


test('The optional HyDE button appears only when the Pro workflow is registered', async t => {
  const build_html = load_post_process('build_html');
  const free_html = await build_html.call(create_component(), { env: { config: { actions: {} } } });
  const pro_html = await build_html.call(create_component(), { env: { config: { actions: { lookup_list_generate_hyde: {} } } } });
  t.false(free_html.includes('lookup-hyde-submit'));
  t.true(pro_html.includes('lookup-hyde-submit'));
  t.true(pro_html.includes('TopK query excerpts'));
  t.true(pro_html.includes('>Generate HyDE</button>'));
});

function create_pro_view(actions) {
  const items = new Map();
  const view = {
    env: {
      lookup_lists: {
        get(key) { return items.get(key); },
        new_item({ query }) {
          const key = `lookup:${query}`;
          if (!items.has(key)) items.set(key, {
            key, data: { query }, results: null, actions, env: view.env,
          });
          return items.get(key);
        },
      },
      smart_sources: { embed_model: { is_loaded: true } },
      smart_components: { async render_component(key, item, params) { return params.results; } },
    },
  };
  return view;
}

test('HyDE runs after Lookup with the same query, prevents duplicate clicks, and permits explicit retry', async t => {
  const elements = create_lookup_view_elements({ pro: true });
  const deferred = create_deferred();
  const calls = [];
  const view = create_pro_view({
    async lookup_list_get_results_query(params) { calls.push(['query', params]); return ['query']; },
    lookup_list_generate_hyde(params, request_context) { calls.push(['hyde', params, request_context]); return deferred.promise; },
  });
  await load_post_process().call(create_component(), view, elements.container);
  t.true(elements.hyde_btn.disabled);
  elements.query_input.value = 'same query';
  elements.query_form.dispatch('submit', { preventDefault() {} });
  await flush_async();
  elements.hyde_btn.dispatch('click');
  elements.hyde_btn.dispatch('click');
  t.deepEqual(calls.map(call => call[0]), ['query', 'hyde']);
  t.true(elements.hyde_btn.disabled);
  t.false(Object.hasOwn(calls[1][1], 'is_current'));
  t.true(calls[1][2].is_current());
  deferred.resolve(['hyde']);
  await flush_async();
  t.false(elements.hyde_btn.disabled);
  t.deepEqual(elements.list_container.children, [['hyde']]);
  elements.hyde_btn.dispatch('click');
  await flush_async();
  t.is(calls.length, 3);
});

test('Automatic input submission remains query-only in Pro', async t => {
  const elements = create_lookup_view_elements({ pro: true });
  elements.auto_submit_input.checked = true;
  let queries = 0;
  const view = create_pro_view({
    async lookup_list_get_results_query() { queries++; return []; },
    async lookup_list_generate_hyde() { t.fail('Typing must not call the chat workflow.'); },
  });
  await load_post_process().call(create_component(), view, elements.container);
  elements.query_input.value = 'typed query';
  elements.query_input.dispatch('input');
  await flush_async();
  t.is(queries, 1);
});

test('Editing and restoring text invalidates an older generation without replacing current results', async t => {
  const elements = create_lookup_view_elements({ pro: true });
  const deferred = create_deferred();
  let request_context;
  const view = create_pro_view({
    async lookup_list_get_results_query() { return ['new-query']; },
    lookup_list_generate_hyde(params, context) { request_context = context; return deferred.promise; },
  });
  await load_post_process().call(create_component(), view, elements.container);
  elements.query_input.value = 'intent';
  elements.hyde_btn.dispatch('click');
  t.true(request_context.is_current());
  elements.query_input.value = 'other';
  elements.query_input.dispatch('input');
  elements.query_input.value = 'intent';
  elements.query_input.dispatch('input');
  t.false(request_context.is_current());
  elements.query_form.dispatch('submit', { preventDefault() {} });
  await flush_async();
  deferred.resolve(['stale-document']);
  await flush_async();
  t.deepEqual(elements.list_container.children, [['new-query']]);
});

test('A model-loading failure clears the pending state and permits retry', async t => {
  const elements = create_lookup_view_elements({ pro: true });
  let attempts = 0;
  const view = create_pro_view({ async lookup_list_get_results_query() { return []; } });
  view.env.smart_sources.embed_model = {
    is_loaded: false,
    async load_background() { attempts++; throw new Error('Loading failed'); },
  };
  await load_post_process().call(create_component(), view, elements.container);
  elements.query_input.value = 'intent';
  elements.query_form.dispatch('submit', { preventDefault() {} });
  await flush_async();
  t.true(elements.list_container.inner_html.includes('role="alert"'));
  elements.query_form.dispatch('submit', { preventDefault() {} });
  await flush_async();
  t.is(attempts, 2);
});


test('Both presenters and tools use equivalent retrieval inputs without presenter state', async t => {
  const elements = create_lookup_view_elements();
  const calls = [];
  const view = create_pro_view({
    async lookup_list_get_results_query(params) { calls.push(params); return []; },
  });
  let scope_params;
  let render_params;
  const lookup_list = {
    key: 'lookup',
    data: { query: 'intent' },
    results: null,
    actions: {
      async lookup_list_get_results(params) { calls.push(params); return []; },
      ...view.env.lookup_lists.new_item({ query: 'intent' }).actions,
    },
  };
  view.env.lookup_lists.new_item = params => { scope_params = params; return lookup_list; };
  view.env.smart_components.render_component = async (key, item, params) => {
    render_params = params;
    return create_element();
  };
  const params = {
    query: '  intent  ', limit: 4, results_collection_key: 'smart_sources',
    filter: { key_starts_with: 'Notes/' },
    view, app: { workspace: {} }, workspace: {}, container: elements.container,
    is_current: () => true, auto_submit: false, event_source: 'selection',
    hyde_request_id: 7, rendering_state: {}, results: [], lookup_list,
    score_algo_key: 'chat_rank', score_settings: { weight: 9 },
    embed_request: { embed_input: 'override', purpose: 'document' },
    to_item: {}, include_content: true,
  };
  await load_post_process().call(create_component(), view, elements.container, params);
  await flush_async();
  const expected = {
    query: 'intent', limit: 4, results_collection_key: 'smart_sources', filter: params.filter,
  };
  t.deepEqual(calls[0], expected);
  t.deepEqual(scope_params, expected);
  t.is(render_params.event_source, 'selection');
  t.is(render_params.view, view);

  const component = { ...create_component(), create_doc_fragment: html => ({ html }) };
  await load_post_process('post_process', 'v3/list.js').call(component, lookup_list, create_element(), {
    ...params, query: calls[0].query, results: undefined,
  });
  t.deepEqual(calls[1], { ...expected, hypothetical_document: undefined });

  // Optional undefined fields disappear in the existing shared action normalizer.
  const env = { smart_sources: {}, lookup_lists: {
    results_collection_key: 'smart_sources', new_lookup_list: params => ({ data: { query: params.query } }),
  } };
  const tool_params = project_lookup_list_request({ ...expected, include_content: true }, { env }).params;
  t.deepEqual(project_lookup_list_request(calls[0], { env }).params, tool_params);
  t.deepEqual(project_lookup_list_request(calls[1], { env }).params, tool_params);
});

test('V3 preserves explicit document inputs and skips retrieval for supplied results', async t => {
  const calls = [];
  const lookup_list = { key: 'lookup', actions: {
    async lookup_list_get_results(params) { calls.push(params); return []; },
  } };
  const component = { ...create_component(), create_doc_fragment: html => ({ html }) };
  const params = {
    hypothetical_document: { path: 'Notes/Hypothetical.md', content: 'Hypothetical passage' },
    results_collection_key: 'smart_sources', limit: 4, filter: { key_starts_with: 'Notes/' },
    view: {}, app: {}, workspace: {}, container: {}, is_current: () => true,
  };
  const post_process = load_post_process('post_process', 'v3/list.js');
  await post_process.call(component, lookup_list, create_element(), params);
  t.deepEqual(calls, [{
    query: undefined, hypothetical_document: params.hypothetical_document,
    results_collection_key: params.results_collection_key, limit: params.limit, filter: params.filter,
  }]);
  await post_process.call(component, lookup_list, create_element(), { ...params, results: [] });
  t.is(calls.length, 1);
});

test('Normal and explicit HyDE submissions never reuse a presenter document', async t => {
  const elements = create_lookup_view_elements({ pro: true });
  const calls = [];
  const view = create_pro_view({
    async lookup_list_get_results_query(params) { calls.push(['query', params]); return []; },
    async lookup_list_generate_hyde(params, context) {
      calls.push(['hyde', params]);
      t.true(context.is_current());
      return [];
    },
  });
  await load_post_process().call(create_component(), view, elements.container, {
    query: 'intent', hypothetical_document: { path: 'Old.md', content: 'Old generated text' },
    is_current: () => false, score_algo_key: 'chat_rank', score_settings: {},
  });
  await flush_async();
  elements.hyde_btn.dispatch('click');
  await flush_async();
  elements.query_form.dispatch('submit', { preventDefault() {} });
  await flush_async();
  t.deepEqual(calls.map(([key]) => key), ['query', 'hyde', 'query']);
  for (const [, params] of calls) {
    t.deepEqual(params, {
      query: 'intent', limit: undefined, results_collection_key: undefined, filter: undefined,
    });
  }
});

function create_menu() {
  return {
    items: [],
    addItem(configure) {
      const item = {
        setTitle(title) { this.title = title; return this; },
        setIcon(icon) { this.icon = icon; return this; },
        setDisabled(disabled) { this.disabled = disabled; return this; },
        onClick(callback) { this.click = callback; return this; },
      };
      configure(item);
      this.items.push(item);
      return this;
    },
    addSeparator() {
      this.items.push({ separator: true });
      return this;
    },
  };
}

async function submit_lookup(elements, query) {
  elements.query_input.value = query;
  elements.query_form.dispatch('submit', { preventDefault() {} });
  await flush_async();
}

test('Top bar renders accessible history, refresh, and fold controls with an enabled menu', async t => {
  const view = create_pro_view({});
  const html = await load_post_process('build_html').call(create_component(), view);
  for (const action of ['history-back', 'history-forward', 'refresh-lookup', 'toggle-expanded']) {
    t.true(html.includes(`data-action="${action}"\n          disabled`));
  }
  t.false(html.includes('data-action="open-menu"\n          disabled'));
  for (const icon of ['arrow-left', 'arrow-right', 'refresh-cw', 'unfold-vertical', 'menu']) {
    t.true(html.includes(`data-icon="${icon}"`));
  }
  t.true(html.includes('aria-label="Previous query"'));
  t.true(html.includes('aria-label="Next query"'));
  t.true(html.includes('aria-label="Refresh lookup"'));
  t.true(html.includes('aria-label="Expand all results"'));
  const menu_index = html.indexOf('data-action="open-menu"');
  const fold_index = html.indexOf('data-action="toggle-expanded"');
  const refresh_index = html.indexOf('data-action="refresh-lookup"');
  const forward_index = html.indexOf('data-action="history-forward"');
  const back_index = html.indexOf('data-action="history-back"');
  const label_index = html.indexOf('class="lookup-query-label"');
  const form_index = html.indexOf('<form class="lookup-query-form"');
  t.true(menu_index < fold_index);
  t.true(fold_index < refresh_index);
  t.true(refresh_index < back_index);
  t.true(back_index < forward_index);
  t.true(forward_index < label_index);
  t.true(label_index < form_index);
});

test.serial('Registered Settings and Help stay available before, during, and after a lookup, including errors', async t => {
  const elements = create_lookup_view_elements();
  const deferred = create_deferred();
  let should_fail = false;
  let settings_calls = 0;
  const opened_urls = [];
  const original_window = globalThis.activeWindow;
  globalThis.activeWindow = {
    open(url, target) { opened_urls.push({ url, target }); },
  };
  t.teardown(() => {
    if (original_window === undefined) delete globalThis.activeWindow;
    else globalThis.activeWindow = original_window;
  });
  const view = create_pro_view({
    lookup_list_get_results_query() {
      if (should_fail) return Promise.reject(new Error('Lookup failed'));
      return deferred.promise;
    },
  });
  view.app = { workspace: {} };
  view.open_settings = async () => { settings_calls++; };
  const lookup_list = view.env.lookup_lists.new_item({ query: 'pending query' });
  lookup_list.env = view.env;
  view.env.config = {
    actions: {
      lookup_open_help: { action: lookup_open_help, menus: help_menus },
      lookup_open_settings: { action: lookup_open_settings, menus: settings_menus },
      existing_list_action: {
        action() {},
        menus: { 'lookup:list_menu': { title: 'Existing list action' } },
      },
    },
  };
  view.env.build_menu = (key, menu, scope, params) => {
    if (key === 'lookup:list_menu') {
      t.is(scope, lookup_list);
      t.is(params.view, view);
    } else {
      t.is(key, 'lookup:item_view_list_menu');
      t.is(scope, view);
    }
    return build_menu(view.env, key, menu, scope, params);
  };
  const build_lookup_list_menu = load_post_process('build_lookup_list_menu', 'v3/list.js', {
    Menu: function (app) {
      t.is(app, view.app);
      return create_menu();
    },
  });
  const shown_menus = [];
  await load_post_process('post_process', 'item_view.js', {
    build_lookup_list_menu,
    show_menu(menu, event, anchor) {
      t.is(anchor, elements.menu_button);
      shown_menus.push(menu);
    },
  }).call(create_component(), view, elements.container);

  const open_menu = () => elements.menu_button.dispatch('click', {
    preventDefault() {}, stopPropagation() {},
  });
  open_menu();
  t.deepEqual(shown_menus[0].items.map(item => item.title), ['Open settings', 'Help']);
  t.is(shown_menus[0].items[0].icon, 'settings');
  t.is(shown_menus[0].items[1].icon, 'help-circle');
  t.deepEqual(shown_menus[0].items.map(item => item._action_key), ['lookup_open_settings', 'lookup_open_help']);
  t.true(await shown_menus[0].items[0].click());
  t.true(await shown_menus[0].items[1].click());
  t.is(settings_calls, 1);
  t.deepEqual(opened_urls, [{
    url: 'https://smartconnections.app/smart-lookup/getting-started/',
    target: '_external',
  }]);

  await submit_lookup(elements, 'pending query');
  open_menu();
  t.deepEqual(shown_menus[1].items.map(item => item.title), ['Open settings', 'Help']);
  t.false(elements.menu_button.disabled);

  deferred.resolve([{ item: { key: 'Note.md' }, score: 1 }]);
  await flush_async();
  elements.menu_button.dispatch('keydown', {
    key: 'Enter', preventDefault() {}, stopPropagation() {},
  });
  t.is(shown_menus[2].items[0].title, 'Existing list action');
  t.true(shown_menus[2].items[1].separator);
  t.is(shown_menus[2].items[2].title, 'Open settings');
  t.is(shown_menus[2].items[3].title, 'Help');

  should_fail = true;
  await submit_lookup(elements, 'failing query');
  open_menu();
  t.true(elements.list_container.inner_html.includes('role="alert"'));
  t.deepEqual(shown_menus[3].items.map(item => item.title), ['Open settings', 'Help']);
  await shown_menus[3].items[0].click();
  t.is(settings_calls, 2);
});

test('The view menu uses registered placement metadata and dispatches with the view scope', async t => {
  const elements = create_lookup_view_elements();
  const view = create_pro_view({});
  const calls = [];
  const shown_menus = [];
  view.env.config = {
    actions: {
      lookup_open_help: {
        action(params) {
          calls.push({ scope: this, params });
          return true;
        },
        menus: {
          'lookup:item_view_list_menu': { title: 'Lookup docs', icon: 'book-open', order: 100 },
        },
      },
    },
  };
  view.env.build_menu = (key, menu, scope, params) => build_menu(view.env, key, menu, scope, params);
  await load_post_process('post_process', 'item_view.js', {
    build_lookup_list_menu() { return create_menu(); },
    show_menu(menu) { shown_menus.push(menu); },
  }).call(create_component(), view, elements.container);

  elements.menu_button.dispatch('click', { preventDefault() {}, stopPropagation() {} });
  const menu = shown_menus[0];
  t.deepEqual(menu.items.map(item => item.title), ['Lookup docs']);
  t.is(menu.items[0].icon, 'book-open');
  t.is(menu.items[0]._menu_key, 'lookup:item_view_list_menu');
  t.false(menu.items[0].disabled);
  t.true(await menu.items[0].click());
  t.is(calls[0].scope, view);
  t.deepEqual(calls[0].params, {
    event_source: 'menu:lookup:item_view_list_menu:lookup_open_help',
  });
});

test('History stores item keys and traverses retained results without retrieval or duplicate entries', async t => {
  const elements = create_lookup_view_elements();
  const calls = [];
  const view = create_pro_view({
    async lookup_list_get_results_query({ query }) { calls.push(query); return []; },
  });
  await load_post_process().call(create_component(), view, elements.container);
  t.true(elements.back_button.disabled);
  t.true(elements.forward_button.disabled);
  await submit_lookup(elements, '  first  ');
  await submit_lookup(elements, 'first');
  t.deepEqual(calls, ['first']);
  t.true(elements.back_button.disabled);
  await submit_lookup(elements, 'second');
  t.false(elements.back_button.disabled);
  t.true(elements.forward_button.disabled);

  elements.back_button.dispatch('click');
  await flush_async();
  t.is(elements.query_input.value, 'first');
  t.true(elements.back_button.disabled);
  t.false(elements.forward_button.disabled);
  elements.back_button.dispatch('click');
  t.deepEqual(calls, ['first', 'second']);
  elements.forward_button.dispatch('click');
  await flush_async();
  t.is(elements.query_input.value, 'second');
  t.deepEqual(calls, ['first', 'second']);
  t.deepEqual(view.query_history.keys, ['lookup:first', 'lookup:second']);
  t.is(view.query_history.index, 1);
  t.true(elements.forward_button.disabled);
});

test('A new query after Back replaces only the forward history branch', async t => {
  const elements = create_lookup_view_elements();
  const view = create_pro_view({ async lookup_list_get_results_query() { return []; } });
  await load_post_process().call(create_component(), view, elements.container);
  for (const query of ['first', 'second', 'third']) await submit_lookup(elements, query);
  elements.back_button.dispatch('click');
  await flush_async();
  t.false(elements.forward_button.disabled);
  await submit_lookup(elements, 'replacement');
  t.deepEqual(view.query_history.keys, ['lookup:first', 'lookup:second', 'lookup:replacement']);
  t.is(view.query_history.index, 2);
  t.true(elements.forward_button.disabled);
  await submit_lookup(elements, '   ');
  t.deepEqual(view.query_history.keys, ['lookup:first', 'lookup:second', 'lookup:replacement']);
});

test('History survives rerenders of the same view but not a new view instance', async t => {
  const elements = create_lookup_view_elements();
  const view = create_pro_view({ async lookup_list_get_results_query() { return []; } });
  const post_process = load_post_process();
  await post_process.call(create_component(), view, elements.container, { query: 'opening query' });
  await flush_async();
  await submit_lookup(elements, 'second');
  elements.back_button.dispatch('click');
  await flush_async();
  elements.container.dispose();

  const rerendered = create_lookup_view_elements();
  await post_process.call(create_component(), view, rerendered.container);
  await flush_async();
  t.is(rerendered.query_input.value, 'opening query');
  t.deepEqual(view.query_history.keys, ['lookup:opening query', 'lookup:second']);
  t.false(rerendered.forward_button.disabled);
  const new_view = create_pro_view({});
  const fresh = create_lookup_view_elements();
  await post_process.call(create_component(), new_view, fresh.container);
  t.deepEqual(new_view.query_history.keys, []);
  t.is(new_view.query_history.index, -1);
  t.is(fresh.query_input.value, '');
});

test('History navigation cancels a pending automatic submission', async t => {
  const elements = create_lookup_view_elements();
  const calls = [];
  let pending_submit = null;
  const view = create_pro_view({
    async lookup_list_get_results_query({ query }) { calls.push(query); return []; },
  });
  await load_post_process('post_process', 'item_view.js', {
    create_debounced_submit(callback) {
      const submit = query => { pending_submit = () => callback(query); };
      submit.cancel = () => { pending_submit = null; };
      return submit;
    },
  }).call(create_component(), view, elements.container);
  await submit_lookup(elements, 'first');
  await submit_lookup(elements, 'second');
  elements.auto_submit_input.checked = true;
  elements.query_input.value = 'unsubmitted draft';
  elements.query_input.dispatch('input');
  t.is(typeof pending_submit, 'function');
  elements.back_button.dispatch('click');
  await flush_async();
  t.is(pending_submit, null);
  t.is(elements.query_input.value, 'first');
  t.deepEqual(calls, ['first', 'second']);
  t.deepEqual(view.query_history.keys, ['lookup:first', 'lookup:second']);
});

test('A pending result cannot overwrite a query selected from history', async t => {
  const elements = create_lookup_view_elements();
  const deferred = create_deferred();
  const view = create_pro_view({
    lookup_list_get_results_query({ query }) {
      return query === 'pending' ? deferred.promise : Promise.resolve([query]);
    },
  });
  await load_post_process().call(create_component(), view, elements.container);
  await submit_lookup(elements, 'first');
  await submit_lookup(elements, 'pending');
  elements.back_button.dispatch('click');
  await flush_async();
  deferred.resolve(['stale']);
  await flush_async();
  t.is(elements.query_input.value, 'first');
  t.deepEqual(elements.list_container.children, [['first']]);
  t.deepEqual(view.query_history.keys, ['lookup:first', 'lookup:pending']);
  t.is(view.env.lookup_lists.get('lookup:pending').results, null);
  t.is(view.query_history.index, 0);
});

test('History restores final HyDE results without invoking query or generation actions', async t => {
  const elements = create_lookup_view_elements({ pro: true });
  const calls = [];
  const view = create_pro_view({
    async lookup_list_get_results_query({ query }) { calls.push(['query', query]); return ['query-results']; },
    async lookup_list_generate_hyde({ query }) { calls.push(['hyde', query]); return ['final-hyde-results']; },
  });
  await load_post_process().call(create_component(), view, elements.container);
  await submit_lookup(elements, 'first');
  elements.query_input.value = 'generated';
  elements.hyde_btn.dispatch('click');
  await flush_async();
  elements.back_button.dispatch('click');
  await flush_async();
  elements.forward_button.dispatch('click');
  await flush_async();
  t.deepEqual(calls, [
    ['query', 'first'], ['hyde', 'generated'],
  ]);
  t.deepEqual(view.query_history.keys, ['lookup:first', 'lookup:generated']);
  t.deepEqual(elements.list_container.children, [['final-hyde-results']]);
  t.deepEqual(view.env.lookup_lists.get('lookup:generated').results, ['final-hyde-results']);
});

test('Fold toggles all local results and carries the selection into subsequent queries without saving settings', async t => {
  const elements = create_lookup_view_elements();
  const result_elements = [create_element(), create_element()];
  const outside_result = create_element();
  outside_result.classList.toggle('sc-collapsed', true);
  elements.list_container.set_selector('.lookup-result', result_elements);
  let retrieval_calls = 0;
  const view = create_pro_view({
    async lookup_list_get_results_query() {
      retrieval_calls++;
      return [{ item: { key: 'First.md' } }, { item: { key: 'Second.md' } }];
    },
  });
  const settings = { expanded_view: false, components: { lookup_v3_list_item: { show_full_path: true } } };
  view.env.lookup_lists.settings = settings;
  let render_params;
  view.env.smart_components.render_component = async (key, scope, params) => {
    render_params = params;
    for (const element of result_elements) {
      element.classList.toggle('sc-collapsed', !params.lookup_settings.expanded_view);
    }
    return create_element();
  };
  await load_post_process().call(create_component(), view, elements.container);
  t.true(elements.fold_button.disabled);
  await submit_lookup(elements, 'first');
  t.false(elements.fold_button.disabled);
  elements.fold_button.dispatch('click');
  t.true(result_elements.every(element => !element.classList.contains('sc-collapsed')));
  t.true(outside_result.classList.contains('sc-collapsed'));
  t.is(elements.fold_button.attributes['aria-label'], 'Collapse all results');
  t.true(elements.fold_button.inner_html.includes('data-icon="fold-vertical"'));
  t.is(retrieval_calls, 1);
  t.false(settings.expanded_view);

  await submit_lookup(elements, 'second');
  t.true(render_params.lookup_settings.expanded_view);
  t.is(render_params.lookup_settings.components, settings.components);
  elements.fold_button.dispatch('click');
  t.true(result_elements.every(element => element.classList.contains('sc-collapsed')));
  t.is(elements.fold_button.attributes.title, 'Expand all results');
  t.true(elements.fold_button.inner_html.includes('data-icon="unfold-vertical"'));
  t.is(retrieval_calls, 2);
  t.false(settings.expanded_view);
});

test('Fold honors an expanded settings override and stays disabled for empty results', async t => {
  const elements = create_lookup_view_elements();
  const settings = { expanded_view: true };
  const view = create_pro_view({ async lookup_list_get_results_query() { return []; } });
  view.env.lookup_lists.settings = { expanded_view: false };
  await load_post_process().call(create_component(), view, elements.container, { lookup_settings: settings });
  await submit_lookup(elements, 'no matches');
  t.true(elements.fold_button.disabled);
  t.is(elements.fold_button.attributes['aria-label'], 'Collapse all results');
  elements.fold_button.dispatch('click');
  t.true(settings.expanded_view);
  t.is(elements.fold_button.attributes['aria-label'], 'Collapse all results');
  t.false(elements.menu_button.disabled);
});

test('Disposing the presenter cancels queued queries and invalidates pending results', async t => {
  const elements = create_lookup_view_elements();
  const deferred = create_deferred();
  let pending_submit = null;
  const view = create_pro_view({ lookup_list_get_results_query() { return deferred.promise; } });
  await load_post_process('post_process', 'item_view.js', {
    create_debounced_submit(callback) {
      const submit = query => { pending_submit = () => callback(query); };
      submit.cancel = () => { pending_submit = null; };
      return submit;
    },
  }).call(create_component(), view, elements.container);
  await submit_lookup(elements, 'pending query');
  elements.container.dispose();
  deferred.resolve(['stale']);
  await flush_async();
  t.deepEqual(elements.list_container.children, []);

  const queued = create_lookup_view_elements();
  const next_view = create_pro_view({});
  await load_post_process('post_process', 'item_view.js', {
    create_debounced_submit(callback) {
      const submit = query => { pending_submit = () => callback(query); };
      submit.cancel = () => { pending_submit = null; };
      return submit;
    },
  }).call(create_component(), next_view, queued.container);
  queued.auto_submit_input.checked = true;
  queued.query_input.value = 'queued query';
  queued.query_input.dispatch('input');
  t.is(typeof pending_submit, 'function');
  queued.container.dispose();
  t.is(pending_submit, null);
  t.deepEqual(next_view.query_history.keys, []);
});

test('Navigation and rerender read item-owned results without loading the model or writing the cache', async t => {
  const elements = create_lookup_view_elements();
  const first_results = [{ item: { key: 'First.md' }, score: 0.8 }];
  const second_results = [{ item: { key: 'Second.md' }, score: 0.7 }];
  let retrieval_calls = 0;
  const view = create_pro_view({
    async lookup_list_get_results_query({ query }) {
      retrieval_calls++;
      return query === 'first' ? first_results : second_results;
    },
  });
  const post_process = load_post_process();
  await post_process.call(create_component(), view, elements.container);
  await submit_lookup(elements, 'first');
  await submit_lookup(elements, 'second');
  const first_list = view.env.lookup_lists.get(view.query_history.keys[0]);
  t.is(first_list.data.query, 'first');
  t.is(first_list.results, first_results);
  t.deepEqual(Object.keys(view.query_history).sort(), ['index', 'keys']);
  Object.defineProperty(first_list, 'results', {
    get() { return first_results; },
    set() { t.fail('History must not write retained results.'); },
  });
  view.env.smart_sources.embed_model = {
    is_loaded: false,
    async load_background() { t.fail('History must not load a model.'); },
  };
  elements.back_button.dispatch('click');
  await flush_async();
  t.is(elements.list_container.children[0], first_results);
  elements.container.dispose();
  const rerendered = create_lookup_view_elements();
  await post_process.call(create_component(), view, rerendered.container);
  await flush_async();
  t.is(rerendered.list_container.children[0], first_results);
  t.is(rerendered.query_input.value, 'first');
  t.is(retrieval_calls, 2);
});

test('Refresh reuses the selected key, cancels duplicate clicks, and preserves forward history', async t => {
  const elements = create_lookup_view_elements();
  const deferred = create_deferred();
  const calls = [];
  const view = create_pro_view({
    lookup_list_get_results_query({ query }) {
      calls.push(query);
      return calls.length === 3 ? deferred.promise : Promise.resolve([query]);
    },
  });
  await load_post_process().call(create_component(), view, elements.container);
  t.true(elements.refresh_button.disabled);
  await submit_lookup(elements, 'first');
  await submit_lookup(elements, 'second');
  elements.back_button.dispatch('click');
  await flush_async();
  const first_list = view.env.lookup_lists.get(view.query_history.keys[0]);
  // Refresh must not re-key a historical item, including after a date boundary.
  view.env.lookup_lists.new_item = () => t.fail('Refresh must reuse the selected item.');
  elements.refresh_button.dispatch('click');
  elements.refresh_button.dispatch('click');
  t.true(elements.refresh_button.disabled);
  t.deepEqual(calls, ['first', 'second', 'first']);
  t.is(view.query_history.index, 0);
  t.deepEqual(view.query_history.keys, ['lookup:first', 'lookup:second']);
  t.false(elements.forward_button.disabled);
  deferred.resolve([]);
  await flush_async();
  t.false(elements.refresh_button.disabled);
  t.deepEqual(first_list.results, []);
  elements.forward_button.dispatch('click');
  await flush_async();
  elements.back_button.dispatch('click');
  await flush_async();
  t.is(elements.list_container.children[0], first_list.results);
  t.is(calls.length, 3);
});

test('Refresh explicitly replaces retained HyDE results with query-only results', async t => {
  const elements = create_lookup_view_elements({ pro: true });
  const calls = [];
  const view = create_pro_view({
    async lookup_list_get_results_query(params) { calls.push(['query', params]); return ['refreshed']; },
    async lookup_list_generate_hyde(params) { calls.push(['hyde', params]); return ['generated']; },
  });
  await load_post_process().call(create_component(), view, elements.container);
  elements.query_input.value = 'intent';
  elements.hyde_btn.dispatch('click');
  await flush_async();
  elements.refresh_button.dispatch('click');
  await flush_async();
  t.deepEqual(calls.map(([key]) => key), ['hyde', 'query']);
  t.deepEqual(calls[1][1], {
    query: 'intent', limit: undefined, results_collection_key: undefined, filter: undefined,
  });
  t.deepEqual(view.query_history.keys, ['lookup:intent']);
  t.deepEqual(view.env.lookup_lists.get('lookup:intent').results, ['refreshed']);
});

test('A failed refresh preserves retained results and permits an explicit retry', async t => {
  const elements = create_lookup_view_elements();
  let fail_next = false;
  let results = ['original'];
  const view = create_pro_view({
    async lookup_list_get_results_query() {
      if (fail_next) throw new Error('Refresh failed');
      return results;
    },
  });
  await load_post_process().call(create_component(), view, elements.container);
  await submit_lookup(elements, 'first');
  await submit_lookup(elements, 'second');
  elements.back_button.dispatch('click');
  await flush_async();
  const first_list = view.env.lookup_lists.get('lookup:first');
  fail_next = true;
  elements.refresh_button.dispatch('click');
  await flush_async();
  t.true(elements.list_container.inner_html.includes('role="alert"'));
  t.is(first_list.results, results);
  t.false(elements.refresh_button.disabled);
  elements.forward_button.dispatch('click');
  await flush_async();
  elements.back_button.dispatch('click');
  await flush_async();
  t.is(elements.list_container.children[0], results);
  fail_next = false;
  results = ['retry'];
  elements.refresh_button.dispatch('click');
  await flush_async();
  t.is(first_list.results, results);
  t.is(elements.list_container.children[0], results);
  t.deepEqual(view.query_history.keys, ['lookup:first', 'lookup:second']);
});

test('History entries without retained results wait for Refresh instead of silently retrieving', async t => {
  const elements = create_lookup_view_elements();
  const calls = [];
  let fail_next = true;
  const view = create_pro_view({
    async lookup_list_get_results_query({ query }) {
      calls.push(query);
      if (query === 'failed' && fail_next) throw new Error('No results available');
      return [];
    },
  });
  await load_post_process().call(create_component(), view, elements.container);
  await submit_lookup(elements, 'first');
  await submit_lookup(elements, 'failed');
  elements.back_button.dispatch('click');
  await flush_async();
  elements.forward_button.dispatch('click');
  await flush_async();
  t.is(elements.query_input.value, 'failed');
  t.true(elements.list_container.inner_html.includes('No retained results'));
  t.false(elements.refresh_button.disabled);
  t.deepEqual(calls, ['first', 'failed']);
  fail_next = false;
  elements.refresh_button.dispatch('click');
  await flush_async();
  t.deepEqual(calls, ['first', 'failed', 'failed']);
  t.deepEqual(view.env.lookup_lists.get('lookup:failed').results, []);
  t.deepEqual(view.query_history.keys, ['lookup:first', 'lookup:failed']);
});

test('A stale refresh cannot replace an item cache after navigating away and back', async t => {
  const elements = create_lookup_view_elements();
  const deferred = create_deferred();
  const original = ['original'];
  let refreshing = false;
  const view = create_pro_view({
    lookup_list_get_results_query() { return refreshing ? deferred.promise : Promise.resolve(original); },
  });
  await load_post_process().call(create_component(), view, elements.container);
  await submit_lookup(elements, 'first');
  await submit_lookup(elements, 'second');
  elements.back_button.dispatch('click');
  await flush_async();
  refreshing = true;
  elements.refresh_button.dispatch('click');
  elements.forward_button.dispatch('click');
  await flush_async();
  elements.back_button.dispatch('click');
  await flush_async();
  deferred.resolve(['stale']);
  await flush_async();
  t.is(view.env.lookup_lists.get('lookup:first').results, original);
  t.is(elements.list_container.children[0], original);
});

test('A stale result renderer cannot commit a refreshed cache after history navigation', async t => {
  const elements = create_lookup_view_elements();
  const deferred = create_deferred();
  const original = ['original'];
  const refreshed = ['refreshed'];
  let results = original;
  const view = create_pro_view({ async lookup_list_get_results_query() { return results; } });
  view.env.smart_components.render_component = async (key, scope, params) => (
    params.results === refreshed ? deferred.promise : params.results
  );
  await load_post_process().call(create_component(), view, elements.container);
  await submit_lookup(elements, 'first');
  await submit_lookup(elements, 'second');
  elements.back_button.dispatch('click');
  await flush_async();
  results = refreshed;
  elements.refresh_button.dispatch('click');
  await flush_async();
  t.is(view.env.lookup_lists.get('lookup:first').results, original);
  elements.forward_button.dispatch('click');
  await flush_async();
  elements.back_button.dispatch('click');
  await flush_async();
  deferred.resolve(refreshed);
  await flush_async();
  t.is(view.env.lookup_lists.get('lookup:first').results, original);
  t.is(elements.list_container.children[0], original);
});

test('A slow history renderer cannot replace a later selected item', async t => {
  const elements = create_lookup_view_elements();
  const deferred = create_deferred();
  let retrieval_calls = 0;
  const view = create_pro_view({
    async lookup_list_get_results_query({ query }) { retrieval_calls++; return [query]; },
  });
  await load_post_process().call(create_component(), view, elements.container);
  await submit_lookup(elements, 'first');
  await submit_lookup(elements, 'second');
  view.env.smart_components.render_component = async (key, scope, params) => (
    params.query === 'first' ? deferred.promise : params.results
  );
  elements.back_button.dispatch('click');
  elements.forward_button.dispatch('click');
  await flush_async();
  deferred.resolve(['first']);
  await flush_async();
  t.is(elements.query_input.value, 'second');
  t.deepEqual(elements.list_container.children, [['second']]);
  t.is(retrieval_calls, 2);
});

test('Refresh cancels queued auto-submit and stays disabled for an unsubmitted draft', async t => {
  const elements = create_lookup_view_elements();
  const calls = [];
  let pending_submit = null;
  const view = create_pro_view({
    async lookup_list_get_results_query({ query }) { calls.push(query); return []; },
  });
  await load_post_process('post_process', 'item_view.js', {
    create_debounced_submit(callback) {
      const submit = query => { pending_submit = () => callback(query); };
      submit.cancel = () => { pending_submit = null; };
      return submit;
    },
  }).call(create_component(), view, elements.container);
  await submit_lookup(elements, 'selected');
  elements.auto_submit_input.checked = true;
  elements.auto_submit_input.dispatch('change');
  t.is(typeof pending_submit, 'function');
  elements.refresh_button.dispatch('click');
  await flush_async();
  t.is(pending_submit, null);
  t.deepEqual(calls, ['selected', 'selected']);
  elements.query_input.value = 'draft';
  elements.query_input.dispatch('input');
  t.true(elements.refresh_button.disabled);
  elements.refresh_button.dispatch('click');
  t.deepEqual(calls, ['selected', 'selected']);
  t.deepEqual(view.query_history.keys, ['lookup:selected']);
});


test('Repeated visits to one key restore its latest results rather than per-visit snapshots', async t => {
  const elements = create_lookup_view_elements();
  let retrieval_calls = 0;
  const view = create_pro_view({
    async lookup_list_get_results_query() { return [++retrieval_calls]; },
  });
  await load_post_process().call(create_component(), view, elements.container);
  await submit_lookup(elements, 'first');
  await submit_lookup(elements, 'second');
  await submit_lookup(elements, 'first');
  t.deepEqual(view.query_history.keys, ['lookup:first', 'lookup:second', 'lookup:first']);
  elements.back_button.dispatch('click');
  await flush_async();
  elements.back_button.dispatch('click');
  await flush_async();
  t.deepEqual(elements.list_container.children, [[3]]);
  t.is(view.query_history.index, 0);
  t.is(retrieval_calls, 3);
});
