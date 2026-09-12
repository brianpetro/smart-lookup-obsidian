Improved: HyDE implementation to be compatible with tool actions

### Input-driven lookup tools

`smart_lookup` uses the supplied query, hypothetical document, or both. `smart_lookup_query` accepts only a query; `smart_lookup_hyde` accepts only a hypothetical document containing `path` and `content`. All three share retrieval, canonical source/block preparation, and existing result fusion. They never call a chat model. Lookup algorithm selectors have been removed; old selections are ignored.

### Explicit HyDE generation in Pro

The adjacent **HyDE** button retrieves query matches, sends bounded TopK excerpts to the configured default chat model, forces one document-tool completion, and searches with that document. Query results are reused for fusion and fallback. Context defaults to 5 results (0-20); 0 omits excerpts. Typing and ordinary Lookup remain query-only. Hypothetical paths are representation hints, not filters or source evidence, and hypothetical items are not saved.

CLI: `smart:lookup` / `lookup` use the combined tool; `smart:lookup:query` and `smart:lookup:hyde` expose the narrow tools. Existing query-only MCP calls remain valid; callers supplying a hypothetical to `smart_lookup_query` must use `smart_lookup` or `smart_lookup_hyde` instead.


