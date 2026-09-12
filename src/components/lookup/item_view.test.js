import test from 'ava';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

function load_post_process(export_name = 'post_process') {
  const dir_name = path.dirname(fileURLToPath(import.meta.url));
  const file_path = path.join(dir_name, 'item_view.js');
  const full_source = fs.readFileSync(file_path, 'utf8');
  const source_start = full_source.indexOf('const REQUIRED_MESSAGE');
  if (source_start === -1) {
    throw new Error('Lookup item view module body not found.');
  }

  const source = full_source
    .slice(source_start)
    .replace(/\bexport\s+(?=(?:async\s+)?function)/g, '')
    .concat('\nmodule.exports = { post_process, build_html };\n')
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
  });

  const script = new vm.Script(source, { filename: file_path });
  script.runInContext(context);
  return context.module.exports[export_name];
}

function create_element() {
  const selectors = new Map();
  const listeners = new Map();
  return {
    attributes: {},
    checked: false,
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

  auto_submit_input.checked = false;
  return {
    auto_submit_input,
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
        new_item() {
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
  t.true(elements.menu_button.disabled);

  results_deferred.resolve(results);
  await flush_async();

  t.is(elements.list_container.attributes['aria-busy'], 'false');
  t.deepEqual(elements.list_container.children, [rendered_list]);
  t.is(render_params.results, results);
  t.false(elements.menu_button.disabled);
});

test('Lookup view clears querying status and permits retry when the action fails', async (t) => {
  const post_process = load_post_process();
  const elements = create_lookup_view_elements();
  const retry_deferred = create_deferred();
  let action_calls = 0;
  const lookup_list = {
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
        new_item() {
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
  t.true(elements.menu_button.disabled);

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
  const lookup_list = {
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
        new_item(params) {
          new_item_calls.push(params);
          return lookup_list;
        },
      },
      smart_components: {
        async render_component() {
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
  t.is(
    action_calls[0].event_source,
    'command:smart-lookup:smart-lookup-selection',
  );
  t.true(elements.list_container.inner_html.includes('Querying...'));

  results_deferred.resolve([]);
  await flush_async();

  t.deepEqual(elements.list_container.children, [rendered_list]);
  t.is(elements.list_container.attributes['aria-busy'], 'false');
});


test('The optional HyDE button appears only when the Pro workflow is registered', async t => {
  const build_html = load_post_process('build_html');
  const free_html = await build_html.call({}, { env: { config: { actions: {} } } });
  const pro_html = await build_html.call({}, { env: { config: { actions: { lookup_list_generate_hyde: {} } } } });
  t.false(free_html.includes('lookup-hyde-submit'));
  t.true(pro_html.includes('lookup-hyde-submit'));
  t.true(pro_html.includes('TopK query excerpts'));
});

function create_pro_view(actions) {
  const scope = { actions };
  return {
    env: {
      lookup_lists: { new_item() { return scope; } },
      smart_sources: { embed_model: { is_loaded: true } },
      smart_components: { async render_component(key, item, params) { return params.results; } },
    },
  };
}

test('HyDE runs after Lookup with the same query, prevents duplicate clicks, and permits explicit retry', async t => {
  const elements = create_lookup_view_elements({ pro: true });
  const deferred = create_deferred();
  const calls = [];
  const view = create_pro_view({
    async lookup_list_get_results_query(params) { calls.push(['query', params]); return ['query']; },
    lookup_list_generate_hyde(params) { calls.push(['hyde', params]); return deferred.promise; },
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
  t.true(calls[1][1].is_current());
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
  let params;
  const view = create_pro_view({
    async lookup_list_get_results_query() { return ['new-query']; },
    lookup_list_generate_hyde(next_params) { params = next_params; return deferred.promise; },
  });
  await load_post_process().call(create_component(), view, elements.container);
  elements.query_input.value = 'intent';
  elements.hyde_btn.dispatch('click');
  t.true(params.is_current());
  elements.query_input.value = 'other';
  elements.query_input.dispatch('input');
  elements.query_input.value = 'intent';
  elements.query_input.dispatch('input');
  t.false(params.is_current());
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
