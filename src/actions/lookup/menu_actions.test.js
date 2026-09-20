import test from 'ava';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ActionsLoader } from 'smart-environment/loaders/actions_loader.js';
import { lookup_open_help, menus as help_menus } from './open_help.js';
import { lookup_open_settings, menus as settings_menus } from './open_settings.js';

test.serial('lookup_open_help opens the Lookup getting started guide externally', t => {
  const opened_urls = [];
  const original_window = globalThis.activeWindow;
  globalThis.activeWindow = {
    open(url, target) { opened_urls.push({ url, target }); },
  };
  t.teardown(() => {
    if (original_window === undefined) delete globalThis.activeWindow;
    else globalThis.activeWindow = original_window;
  });

  t.true(lookup_open_help());
  t.deepEqual(opened_urls, [{
    url: 'https://smartconnections.app/smart-lookup/getting-started/',
    target: '_external',
  }]);
});

test('lookup_open_settings awaits the owning view settings method', async t => {
  let resolve_settings;
  let settings_calls = 0;
  let completed = false;
  const settings_promise = new Promise(resolve => { resolve_settings = resolve; });
  const view = {
    async open_settings() {
      t.is(this, view);
      settings_calls++;
      await settings_promise;
      completed = true;
    },
  };

  const action_promise = lookup_open_settings.call(view);
  t.is(settings_calls, 1);
  t.false(completed);
  resolve_settings();
  t.true(await action_promise);
  t.true(completed);
});

test('lookup_open_settings preserves settings failures', async t => {
  const error = new Error('Settings unavailable');
  const view = { async open_settings() { throw error; } };
  t.is(await t.throwsAsync(() => lookup_open_settings.call(view)), error);
});

test('Help and settings are view menu actions, not result-list actions', t => {
  t.deepEqual(help_menus, {
    'lookup:item_view_list_menu': { title: 'Help', icon: 'help-circle', order: 100 },
  });
  t.deepEqual(settings_menus, {
    'lookup:item_view_list_menu': { title: 'Open settings', icon: 'settings', order: 90 },
  });
});

test('The environment action loader discovers both actions and their menu placements', t => {
  const plugin_dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
  const loader = new ActionsLoader({ dist_dir: plugin_dir });
  loader.scan_root(path.join(plugin_dir, 'src'));
  const config = loader.get_actions_config();
  const imports = loader.build_imports();

  for (const action_name of ['open_help', 'open_settings']) {
    const action_key = `lookup_${action_name}`;
    t.is(config[action_key].action_import_var, `${action_key}_action`);
    t.is(config[action_key].meta.menus, `${action_key}_action_menus`);
    t.true(imports.includes(`${action_key} as ${action_key}_action`));
    t.true(imports.includes(`menus as ${action_key}_action_menus`));
    t.true(imports.includes(`'./src/actions/lookup/${action_name}.js'`));
  }
  t.false(Object.hasOwn(config, 'lookup_menu_actions'));
});
