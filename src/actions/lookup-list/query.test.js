import test from 'ava';
import { lookup_list_query } from './query.js';

test('lookup_list_query creates a Lookup List and returns transport-neutral results', async (t) => {
  const lookup_list = {
    key: '2026-07-28+alpha',
    data: {
      query: 'project alpha',
    },
    actions: {
      async lookup_list_get_results(params) {
        t.deepEqual(params, {
          query: 'project alpha',
        });
        return [
          {
            item: {
              key: 'Notes/Alpha.md',
              collection_key: 'smart_sources',
            },
            score: 0.9,
          },
        ];
      },
    },
  };
  const collection = {
    new_item(params) {
      t.deepEqual(params, {
        query: 'project alpha',
      });
      return lookup_list;
    },
  };

  t.deepEqual(
    await lookup_list_query.call(collection, {
      query: 'project alpha',
    }),
    {
      ok: true,
      key: '2026-07-28+alpha',
      query: 'project alpha',
      total: 1,
      results: [
        {
          key: 'Notes/Alpha.md',
          collection_key: 'smart_sources',
          score: 0.9,
        },
      ],
    },
  );
});
