### Give a short query more ways to match

**HyDE (Pro)** uses your configured chat model to generate sample note passages based on your query, then searches with both those passages and your original words. Duplicate matches are combined into one ranked list of existing sources; the generated passages are search aids, not new notes.

Lookup now keeps its ranking settings separate from Connections. If you use the same scoring method in both products, changing one no longer changes how the other ranks results.

Connected tools can also limit results, search Sources or Blocks, and apply filters through the same retrieval settings used by Lookup.

### Full release notes

#### Search

- Added a shared Lookup retrieval action that follows the search strategy selected in Lookup settings.
- Lookup requests now support a result limit, a Sources or Blocks selection, and filters, including when invoked through connected tools.
- Lookup now uses its own scoring settings for each retrieval, so unrelated Connections settings do not change Lookup ranking when both products use the same scoring method.

#### Pro search

- Added **HyDE (Pro)**: generate hypothetical note passages with a configured chat model, search alongside the original query, combine duplicate matches, and rank the combined results. If HyDE fails, return the original semantic-search results.

#### Maintenance

- Lookup now owns its result lists; the duplicate registration in Smart Connections Pro has been removed.
