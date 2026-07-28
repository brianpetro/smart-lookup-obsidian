import test from 'ava';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

function load_post_process() {
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
    .concat('\nmodule.exports = { post_process };\n')
  ;
  const context = vm.createContext({
    module: { exports: {} },
    exports: {},
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
  return context.module.exports.post_process;
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

function create_lookup_view_elements() {
  const container = create_element();
  const query_input = container.set_selector('.lookup-query-input', create_element());
  const query_form = container.set_selector('.lookup-query-form', create_element());
  const auto_submit_input = container.set_selector('.lookup-query-auto-submit', create_element());
  const submit_btn = container.set_selector('.lookup-query-submit', create_element());
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
      lookup_list_get_results(params) {
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
      lookup_list_get_results() {
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
