import test from 'ava';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

/**
 * Loads list_item.js in a sandbox, stripping its `export` keywords and
 * top-level imports (obsidian-smart-env / ./list.js) that cannot resolve in
 * isolation. Mirrors the vm-based approach in ../item_view.test.js.
 */
function load_module() {
  const dir_name = path.dirname(fileURLToPath(import.meta.url));
  const file_path = path.join(dir_name, 'list_item.js');
  const full_source = fs.readFileSync(file_path, 'utf8');
  const source_start = full_source.indexOf('export async function build_html');
  if (source_start === -1) {
    throw new Error('list_item module body not found.');
  }

  const source = full_source
    .slice(source_start)
    .replace(/\bexport\s+(?=(?:async\s+)?function)/g, '')
    .replace(/\bexport\s+(?=const)/g, '')
    .concat('\nmodule.exports = { escape_html, build_html };\n')
  ;

  const context = vm.createContext({
    module: { exports: {} },
    exports: {},
    console: { error() {} },
    // Symbols referenced by get_result_header_html.
    DISPLAY_SEPARATOR: '\n',
    get_item_display_name: (item) => item.__display_name,
    // Referenced only inside post_process/render (never executed here).
    register_item_hover_popover() {},
    register_item_drag() {},
    open_source() {},
    build_lookup_list_menu() { return null; },
    show_menu() {},
  });

  const script = new vm.Script(source, { filename: file_path });
  script.runInContext(context);
  return context.module.exports;
}

const { escape_html, build_html } = load_module();

const XSS = 'x"><img src=x onerror=alert(1)>';

test('escape_html neutralizes all HTML-sensitive characters', (t) => {
  t.is(escape_html(XSS), 'x&quot;&gt;&lt;img src=x onerror=alert(1)&gt;');
  t.is(escape_html(`&<>"'`), '&amp;&lt;&gt;&quot;&#39;');
});

test('escape_html coerces nullish and non-string values safely', (t) => {
  t.is(escape_html(null), '');
  t.is(escape_html(undefined), '');
  t.is(escape_html(0.42), '0.42');
});

function build_render_scope() {
  return {
    get_icon_html: () => '<svg></svg>',
    create_doc_fragment: (html) => html,
  };
}

function make_result(overrides = {}) {
  const item = {
    env: {},
    path: overrides.path ?? 'Notes/example.md',
    link: overrides.link ?? '',
    collection_key: overrides.collection_key ?? 'smart_sources',
    key: overrides.key ?? 'Notes/example.md',
    __display_name: overrides.display_name ?? 'example.md',
    lines: overrides.lines,
  };
  return {
    item,
    score: overrides.score ?? 0.5,
  };
}

const LOOKUP_SETTINGS = { components: { lookup_v3_list_item: {} }, expanded_view: false };

test('build_html escapes a malicious heading/name in the header', async (t) => {
  const scope = build_render_scope();
  const result = make_result({ display_name: XSS });
  const html = await build_html.call(scope, result, { lookup_settings: LOOKUP_SETTINGS });

  t.false(html.includes('<img src=x onerror=alert(1)>'), 'raw injected element must not appear');
  t.true(html.includes('x&quot;&gt;&lt;img src=x onerror=alert(1)&gt;'), 'name must be escaped');
});

test('build_html escapes malicious item.key in data attributes', async (t) => {
  const scope = build_render_scope();
  const result = make_result({ key: 'Notes/foo.md#' + XSS, display_name: 'foo' });
  const html = await build_html.call(scope, result, { lookup_settings: LOOKUP_SETTINGS });

  t.false(html.includes('data-key="Notes/foo.md#x"><img'), 'attribute breakout must not occur');
  t.true(html.includes('data-key="Notes/foo.md#x&quot;&gt;&lt;img src=x onerror=alert(1)&gt;"'));
});

test('build_html escapes malicious collection_key and path', async (t) => {
  const scope = build_render_scope();
  const result = make_result({ collection_key: 'col"><b>', path: 'Notes/a"><b>.md' });
  const html = await build_html.call(scope, result, { lookup_settings: LOOKUP_SETTINGS });

  t.false(html.includes('col"><b>'), 'collection_key must be escaped');
  t.false(html.includes('Notes/a"><b>.md'), 'path must be escaped');
  t.true(html.includes('data-collection="col&quot;&gt;&lt;b&gt;"'));
});
