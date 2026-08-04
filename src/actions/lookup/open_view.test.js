import test from 'ava';
import {
  register_command_actions,
} from 'obsidian-smart-env/src/utils/command_actions.js';
import {
  build_menu,
} from 'obsidian-smart-env/src/utils/menu_actions.js';
import {
  commands,
  LOOKUP_SELECTION_COMMAND_ID,
  lookup_open_view,
  menus,
} from './open_view.js';

const smart_lookup_plugin = {
  manifest: { id: 'smart-lookup' },
};

const other_plugin = {
  manifest: { id: 'other-plugin' },
};

function create_menu() {
  const items = [];
  return {
    items,
    addItem(configure) {
      const item = {
        setTitle(title) {
          this.title = title;
          return this;
        },
        setIcon(icon) {
          this.icon = icon;
          return this;
        },
        setDisabled(disabled) {
          this.disabled = disabled;
          return this;
        },
        onClick(callback) {
          this.click = callback;
          return this;
        },
      };
      configure(item);
      items.push(item);
      return this;
    },
  };
}

test('lookup_open_view forwards a normalized query to the Lookup view', (t) => {
  const calls = [];
  const plugin = {
    open_lookup_view(params) {
      calls.push(params);
    },
  };

  t.true(lookup_open_view.call({}, {
    active: false,
    event_source: 'test',
    plugin,
    query: '  selected text  ',
  }));
  t.deepEqual(calls, [{
    active: false,
    event_source: 'test',
    query: 'selected text',
  }]);

  t.true(lookup_open_view.call({}, {
    event_source: 'open-only',
    plugin,
  }));
  t.deepEqual(calls[1], {});
  t.false(lookup_open_view.call({}, { query: 'selected text' }));
});

test('selection command adapts highlighted editor text to lookup_open_view', (t) => {
  const command = commands[LOOKUP_SELECTION_COMMAND_ID];
  const editor = {
    getSelection() {
      return '  highlighted text  ';
    },
  };

  t.is(command.context, 'editor');
  t.true(command.register_when({ plugin: smart_lookup_plugin }));
  t.false(command.register_when({ plugin: other_plugin }));
  t.deepEqual(command.params({
    editor,
    plugin: smart_lookup_plugin,
  }), {
    plugin: smart_lookup_plugin,
    query: 'highlighted text',
  });
  t.true(command.when({ params: { query: 'highlighted text' } }));
  t.false(command.when({ params: { query: '' } }));
});

test('configured command connector opens Lookup with the selected query', (t) => {
  const opened = [];
  const registered_commands = [];
  const env = {
    config: {
      actions: {
        lookup_open_view: {
          action: lookup_open_view,
          commands,
        },
      },
    },
  };
  const lookup_lists = { env };
  env.lookup_lists = lookup_lists;

  const plugin = {
    app: {},
    env,
    manifest: { id: 'smart-lookup' },
    addCommand(command) {
      registered_commands.push(command);
    },
    open_lookup_view(params) {
      opened.push(params);
    },
  };

  register_command_actions(plugin);

  const command = registered_commands.find((candidate) => {
    return candidate.id === LOOKUP_SELECTION_COMMAND_ID;
  });
  const editor = {
    getSelection() {
      return '  selected query  ';
    },
  };

  t.is(typeof command?.editorCheckCallback, 'function');
  t.true(command.editorCheckCallback(true, editor, {}));
  t.deepEqual(opened, []);

  t.true(command.editorCheckCallback(false, editor, {}));
  t.deepEqual(opened, [{
    event_source: 'command:smart-lookup:smart-lookup-selection',
    query: 'selected query',
  }]);
});

test('selection editor menu opens Lookup with the highlighted query', async (t) => {
  const opened = [];
  const env = {
    config: {
      actions: {
        lookup_open_view: {
          action: lookup_open_view,
          menus,
        },
      },
    },
  };
  const lookup_lists = { env };
  env.lookup_lists = lookup_lists;

  const plugin = {
    open_lookup_view(params) {
      opened.push(params);
    },
  };
  const menu = create_menu();

  build_menu(
    env,
    'lookup:editor_menu',
    menu,
    lookup_lists,
    {
      plugin,
      query: 'highlighted text',
    },
  );

  t.is(menu.items.length, 1);
  t.is(menu.items[0].title, 'Search selection with Smart Lookup');
  t.is(menu.items[0].icon, 'smart-lookup');
  t.false(menu.items[0].disabled);

  await menu.items[0].click();

  t.deepEqual(opened, [{
    event_source: 'menu:lookup:editor_menu:lookup_open_view',
    query: 'highlighted text',
  }]);

  const empty_menu = create_menu();
  build_menu(
    env,
    'lookup:editor_menu',
    empty_menu,
    lookup_lists,
    {
      plugin,
      query: '',
    },
  );
  t.is(empty_menu.items.length, 0);
});
