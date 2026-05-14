import { DISPLAY_SEPARATOR, get_item_display_name } from 'obsidian-smart-env/src/utils/get_item_display_name.js';
import { register_item_hover_popover } from 'obsidian-smart-env/src/utils/register_item_hover_popover.js';
import { register_item_drag } from 'obsidian-smart-env/src/utils/register_item_drag.js';
import { open_source } from "obsidian-smart-env/src/utils/open_source.js";

/**
 * Builds the HTML string for the result component.
 * .temp-container is used so listeners can be added to .lookup-result (otherwise does not persist)
 * @this {import('smart-types').SmartViewLike}
 * @param {import('smart-types').LookupResultScope} result - The results a <Result> object
 * @param {import('smart-types').LookupListItemParams} [params={}] - Optional parameters.
 * @returns {Promise<string>} A promise that resolves to the HTML string.
 */
export async function build_html(result, params = {}) {
  const item = result.item;
  const env = item.env;
  const score = result.score; // Extract score from opts
  const lookup_settings = params.lookup_settings
    ?? env.lookup_lists.settings
  ;
  const component_settings = lookup_settings.components?.lookup_v3_list_item || {};
  const header_html = get_result_header_html(score, item, component_settings);
  const all_expanded = lookup_settings.expanded_view;
  const escaped_path = escape_html_attr(item.path);
  const escaped_link = escape_html_attr(item.link || '');
  const escaped_collection_key = escape_html_attr(item.collection_key);
  const escaped_key = escape_html_attr(item.key);

  return `<div class="temp-container">
    <div
      class="lookup-result ${all_expanded ? '' : 'sc-collapsed'}"
      data-path="${escaped_path}"
      data-link="${escaped_link}"
      data-collection="${escaped_collection_key}"
      data-score="${escape_html_attr(score)}"
      data-key="${escaped_key}"
      draggable="true"
    >
      <span class="header">
        ${this.get_icon_html('right-triangle')}
        <a class="lookup-result-file-title" href="#" title="${escaped_path}" draggable="true">
          ${header_html}
        </a>
      </span>
      <ul draggable="true">
        <li class="lookup-result-file-title" title="${escaped_path}" data-collection="${escaped_collection_key}" data-key="${escaped_key}"></li>
      </ul>
    </div>
  </div>`;
}

/**
 * Renders the result component by building the HTML and post-processing it.
 * @this {import('smart-types').SmartViewLike}
 * @param {import('smart-types').LookupResultScope} result_scope - The result object containing component data.
 * @param {import('smart-types').LookupListItemParams} [params={}] - Optional parameters.
 * @returns {Promise<HTMLElement>} A promise that resolves to the processed element.
 */
export async function render(result_scope, params = {}) {
  const html = await build_html.call(this, result_scope, params);
  const frag = this.create_doc_fragment(html);
  const container = query_required_element(frag, '.lookup-result');
  post_process.call(this, result_scope, container, params);
  return container;
}

/**
 * Post-processes the rendered document fragment by adding event listeners and rendering entity details.
 * @this {import('smart-types').SmartViewLike}
 * @param {import('smart-types').LookupResultScope} result_scope - The result object containing component data.
 * @param {HTMLElement} container - The document fragment to be post-processed.
 * @param {import('smart-types').LookupListItemParams} [params={}] - Optional parameters.
 * @returns {Promise<HTMLElement>} A promise that resolves to the post-processed element.
 */
export async function post_process(result_scope, container, params = {}) {
  const { item } = result_scope;
  const env = item.env;
  const lookup_settings = params.lookup_settings
    ?? env.lookup_lists.settings
  ;
  const component_settings = lookup_settings.components?.lookup_v3_list_item || {};
  const should_render_markdown = component_settings.render_markdown ?? true;
  if (!should_render_markdown) container.classList.add('lookup-result-plaintext');

  /**
   * @param {HTMLElement} result_elm
   * @returns {Promise<void>}
   */
  const render_result = async (result_elm) => {
    const list_item = query_optional_element(result_elm, 'li');
    if (!list_item || list_item.innerHTML) return;

    const collection_key = result_elm.dataset.collection || '';
    const path = result_elm.dataset.path || '';
    const collection = get_entity_collection(env, collection_key);
    const entity = collection?.get(path);
    if (!entity) return;

    const raw_markdown = await entity.read();
    const markdown = should_render_embed(entity)
      ? `${entity.embed_link || ''}\n\n${raw_markdown}`
      : process_for_rendering(raw_markdown)
    ;
    const entity_frag = should_render_markdown
      ? await this.render_markdown(markdown, entity)
      : create_text_fragment(markdown)
    ;
    list_item.appendChild(entity_frag);
  };

  const toggle_fold_elm = query_optional_element(container, '.header .svg-icon.right-triangle');
  toggle_fold_elm?.addEventListener('click', toggle_result);
  const event_key_domain = params.event_key_domain || 'lookup';
  const drag_event_key = `${event_key_domain}:drag_result`;
  register_item_drag(container, item, { drag_event_key });
  register_item_hover_popover(container, item, { event_key_domain });
  container.addEventListener('click', (event) => {
    void open_source(item, event);
    item.emit_event(`${event_key_domain}:open_result`, { event_source: 'lookup-v3-list-item' });
  });

  const observer = new MutationObserver((mutations) => {
    const has_expansion_change = mutations.some((mutation) => {
      const target = get_mutation_target_element(mutation);
      if (!target) return false;
      return mutation.attributeName === 'class' &&
        mutation.oldValue?.includes('sc-collapsed') !== target.classList.contains('sc-collapsed');
    });

    const first_target = get_mutation_target_element(mutations[0]);
    if (has_expansion_change && first_target && !first_target.classList.contains('sc-collapsed')) {
      void render_result(first_target);
    }
  });
  observer.observe(container, {
    attributes: true,
    attributeOldValue: true,
    attributeFilter: ['class'],
  });

  if (!container.classList.contains('sc-collapsed')) {
    await render_result(container);
  }

  return container;
}

/**
 * @param {number} score
 * @param {import('smart-types').LookupEntity} item
 * @param {import('smart-types').LookupListItemSettings} component_settings
 * @returns {string}
 */
function get_result_header_html(score, item, component_settings = {}) {
  const raw_parts = get_item_display_name(item, component_settings).split(DISPLAY_SEPARATOR).filter(Boolean);
  const parts = format_item_parts(raw_parts, item.lines);
  const name = parts.pop() || item.path || item.key;
  const formatted_score = typeof score === 'number' ? score.toFixed(2) : String(score);
  const separator = '<small class="sc-breadcrumb-separator"> &gt; </small>';
  const parts_html = parts
    .map(part => (`<small class="sc-breadcrumb">${escape_html(part)}</small>`))
    .join(separator)
  ;
  const clean_name = name.endsWith('.md') ? name.replace(/\.md$/, '') : name;
  return [
    `<small class="sc-breadcrumb sc-score">${escape_html(formatted_score)}</small>`,
    parts_html ? `${parts_html}${separator}` : '',
    `<small class="sc-breadcrumb sc-title">${escape_html(clean_name)}</small>`,
  ].join('');
}

/**
 * @param {string[]} parts
 * @param {number[]} [lines]
 * @returns {string[]}
 */
function format_item_parts(parts, lines = []) {
  if (!Array.isArray(parts) || !parts.length) return [];
  const has_line_marker = Array.isArray(lines) && lines.length > 0;
  return parts.map((part) => {
    if (has_line_marker && part.startsWith('{')) {
      return `Lines: ${lines.join('-')}`;
    }
    return part;
  });
}

/**
 * @param {import('smart-types').LookupEntity | null | undefined} entity
 * @returns {boolean}
 */
export function should_render_embed(entity) {
  if (!entity) return false;
  if (entity.is_media) return true;
  return false;
}

/**
 * @param {string} content
 * @returns {string}
 */
export function process_for_rendering(content) {
  // prevent dataview rendering
  if (content.includes('```dataview')) content = content.replace(/```dataview/g, '```\\dataview');
  if (content.includes('```smart-context')) content = content.replace(/```smart-context/g, '```\\smart-context');
  if (content.includes('```smart-chatgpt')) content = content.replace(/```smart-chatgpt/g, '```\\smart-chatgpt');
  // prevent link embedding
  if (content.includes('![[')) content = content.replace(/!\[\[/g, '! [[');
  return content;
}

/**
 * @param {MouseEvent} event
 * @returns {void}
 */
function toggle_result(event) {
  event.preventDefault();
  event.stopPropagation();
  const target = event.target instanceof Element ? event.target : null;
  const result_elm = target?.closest('.lookup-result');
  if (result_elm instanceof HTMLElement) result_elm.classList.toggle('sc-collapsed');
}

/** @type {Record<string, Record<string, string>>} */
export const settings_config = {
  "show_full_path": {
    name: "Show full path",
    type: "toggle",
    description: "Turning on will include the folder path in the lookup results.",
    // default: true,
    group: "Lookup list item",
  },
  "render_markdown": {
    name: "Render markdown",
    type: "toggle",
    description: "Turn off to prevent rendering markdown and display lookup results as plain text.",
    // default: true,
    group: "Lookup list item",
  },
};

/**
 * @param {ParentNode} container
 * @param {string} selector
 * @returns {HTMLElement}
 */
function query_required_element(container, selector) {
  const element = container.querySelector(selector);
  if (element instanceof HTMLElement) return element;
  throw new Error(`Missing required lookup result element: ${selector}`);
}

/**
 * @param {ParentNode} container
 * @param {string} selector
 * @returns {HTMLElement|null}
 */
function query_optional_element(container, selector) {
  const element = container.querySelector(selector);
  return element instanceof HTMLElement ? element : null;
}

/**
 * @param {import('smart-types').LookupEnv} env
 * @param {string} collection_key
 * @returns {import('smart-types').LookupEntityCollection|null}
 */
function get_entity_collection(env, collection_key) {
  const collection = env[collection_key];
  if (is_entity_collection(collection)) return collection;
  return null;
}

/**
 * @param {unknown} value
 * @returns {value is import('smart-types').LookupEntityCollection}
 */
function is_entity_collection(value) {
  return Boolean(value)
    && typeof value === 'object'
    && typeof /** @type {{get?: unknown}} */ (value).get === 'function'
  ;
}

/**
 * @param {MutationRecord | undefined} mutation
 * @returns {HTMLElement|null}
 */
function get_mutation_target_element(mutation) {
  return mutation?.target instanceof HTMLElement ? mutation.target : null;
}

/**
 * @param {string} text
 * @returns {DocumentFragment}
 */
function create_text_fragment(text) {
  const frag = activeDocument.createDocumentFragment();
  frag.appendChild(activeDocument.createTextNode(text));
  return frag;
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

/**
 * @param {unknown} value
 * @returns {string}
 */
function escape_html(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
  ;
}
