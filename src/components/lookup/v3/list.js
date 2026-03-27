export async function build_html(lookup_list, opts = {}) {
  return `<div><div class="lookup-list" data-key="${lookup_list.item.key}"></div></div>`;
}

export async function render(lookup_list, opts = {}) {
  const html = await build_html.call(this, lookup_list, opts);
  const frag = this.create_doc_fragment(html);
  const container = frag.querySelector('.lookup-list');
  post_process.call(this, lookup_list, container, opts);
  return container;
}

export async function post_process(lookup_list, container, opts = {}) {
  container.dataset.key = lookup_list.key;
  const results = await lookup_list.get_results(opts);
  if(!results || !Array.isArray(results) || results.length === 0) {
    const no_results = this.create_doc_fragment('<p class="sc-no-results">No results found</p>');
    container.appendChild(no_results);
    return container;
  }
  const smart_components = lookup_list.env.smart_components;
  const result_frags = await Promise.all(results.map((result) => {
    return smart_components.render_component('lookup_v3_list_item', result, {
      event_key_domain: 'lookup',
      ...opts
    });
  }));
  result_frags.forEach((result_frag) => container.appendChild(result_frag));
  return container;
}
