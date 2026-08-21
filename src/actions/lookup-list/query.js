/**
 * @this {import('jsbrains/smart-types').LookupLists}
 * @param {import('jsbrains/smart-types').LookupComponentParams} [params={}]
 */
export async function lookup_list_query(params = {}) {
  const query = to_trimmed_string(params.query);
  if (!query) throw new Error('Missing required argument: query');

  const lookup_list = this.new_item?.({ query });
  if (!lookup_list) throw new Error('Unable to create Smart Lookup list.');

  const get_results = lookup_list.actions?.lookup_list_get_results;
  const results = typeof get_results === 'function'
    ? await get_results({ query })
    : await lookup_list.get_results?.({ query })
  ;
  const normalized_results = Array.isArray(results)
    ? results.map(to_result).filter(Boolean)
    : []
  ;

  return {
    ok: true,
    key: to_trimmed_string(lookup_list.key)
      || to_trimmed_string(lookup_list.data?.key),
    query: to_trimmed_string(lookup_list.data?.query) || query,
    total: normalized_results.length,
    results: normalized_results,
  };
}

export const display_name = 'Query Smart Lookup';
export const display_description = 'Runs semantic lookup for a query and returns ranked results.';
export const input_schema = {
  type: 'object',
  properties: {
    query: {
      type: 'string',
      minLength: 1,
      description: 'Semantic lookup query.',
    },
  },
  required: ['query'],
  additionalProperties: false,
};
export const output_schema = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    key: { type: 'string' },
    query: { type: 'string' },
    total: { type: 'integer' },
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          collection_key: { type: 'string' },
          score: { type: ['number', 'null'] },
        },
        required: ['key', 'collection_key', 'score'],
        additionalProperties: false,
      },
    },
  },
  required: ['ok', 'key', 'query', 'total', 'results'],
  additionalProperties: false,
};
export const action_scope = {
  type: 'collection',
  collection_key: 'lookup_lists',
};
// Compatibility-only collection wrapper. The canonical public tool is
// lookup_list_get_results on the exact LookupList scope.
export const tool = false;

/** @param {import('jsbrains/smart-types').LookupResult} result */
function to_result(result) {
  const item = result?.item;
  const key = to_trimmed_string(item?.key)
    || to_trimmed_string(item?.data?.key)
    || to_trimmed_string(item?.path)
  ;
  if (!key) return null;

  return {
    key,
    collection_key: to_trimmed_string(item?.collection_key),
    score: Number.isFinite(result?.score) ? result.score : null,
  };
}

/** @param {unknown} value */
function to_trimmed_string(value) {
  return typeof value === 'string' ? value.trim() : '';
}
