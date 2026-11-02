# Security Report — Smart Lookup (Obsidian plugin)

- **Plugin:** Smart Lookup (`smart-lookup`)
- **Version:** 0.1.7
- **Date:** 2026-07-30
- **Scope:** Full plugin source (`./src`, root build/release scripts). Local workspace dependencies (`obsidian-smart-env`, `smart-collections`, `smart-sources`) reviewed only at the integration boundary.

## Threat model

Obsidian plugins run in an Electron renderer with full Node.js and vault access. Note content is
attacker-influenceable in realistic scenarios (synced/shared team vaults, downloaded community
notes, web-clipper imports). Therefore malicious **note content** — not just a malicious plugin —
is the primary untrusted input for this review.

## Findings summary

| # | Severity | Confidence | Status | Category | Location |
|---|----------|-----------|--------|----------|----------|
| 1 | **High** | High | ✅ Fixed | DOM-based XSS via unescaped note content | `src/components/lookup/v3/list_item.js` |
| — | Info | — | Open | `"obsidian": "latest"` unpinned dependency | `package.json` |

---

## Finding 1 — DOM-based XSS in lookup result rendering (HIGH) — ✅ Fixed

- **File:** `src/components/lookup/v3/list_item.js`
- **Lines:** 34–36, 46 (data attributes); 156–163 (`get_result_header_html`)
- **Category:** DOM-based Cross-Site Scripting (string injection)
- **Severity:** High
- **Confidence:** High
- **Status:** ✅ Fixed (2026-07-30)

### What's wrong

`build_html()` builds an HTML **string** via template literals and passes it to
`this.create_doc_fragment(html)` (line 60), which parses it as HTML and appends it into the live
DOM. Several interpolated values derived from **note content** are not HTML-escaped:

- `data-collection="${item.collection_key}"` (line 34)
- `data-score="${score}"` (line 35)
- `data-key="${item.key}"` (lines 36, 46)
- The entire `${header_html}` block (line 42). Inside `get_result_header_html` (lines 156–163),
  the breadcrumb `part`s and the result `name` are injected raw into `<small>…</small>` with no
  escaping.

For block-level results, `item.key`, the breadcrumb parts, and `name` are composed from the source
path plus **markdown heading text** (e.g. `Notes/foo.md#My Heading`). Heading text — and on
macOS/Linux, file names — is free-form and may contain `"`, `<`, `>`.

The author clearly knows escaping is needed here: `item.path`, `item.link`, and `title` are run
through `.replace(/"/g, '&quot;')` (lines 32–33, 41, 46), and status text elsewhere uses a real
`safe_inner_html` sink. The values above were simply missed — and the applied `.replace()` only
handles double quotes, so it does not protect element-content contexts anyway.

### Exploitation

A note with a heading like:

```
x"><img src=x onerror="/* arbitrary JS with vault + require + network */">
```

(or a similarly-named file on macOS/Linux) yields an `item.key`/`name` that breaks out of
`data-key="…"` or injects raw markup via `header_html`. When that note appears in lookup results
and the row renders, the parsed fragment is appended to the document and the `onerror` handler
executes in Obsidian's Electron renderer — effectively local arbitrary code execution (vault
read/write, `require`, outbound network).

### Remediation

- HTML-escape (`&`, `<`, `>`, `"`, `'`) **every** dynamic value before interpolation: `item.key`,
  `item.collection_key`, `score`, and all `part`/`name` values in `get_result_header_html`.
- Prefer building nodes with `createElement` + `textContent`/`dataset` (or Obsidian's `createEl`)
  over string concatenation, which structurally eliminates this class of bug.
- Replace the ad-hoc `.replace(/"/g, '&quot;')` calls with one shared escaping helper used
  consistently.

### Remediation applied (2026-07-30)

- Added an exported `escape_html()` helper in `list_item.js` that escapes all five HTML-sensitive
  characters (`&`, `<`, `>`, `"`, `'`) and safely coerces nullish/non-string values.
- Routed every dynamic interpolation through it in `build_html()` — `item.path`, `item.link`,
  `item.collection_key`, `score`, and `item.key` (both the div attributes and the `<li>`) —
  replacing the old double-quote-only `.replace()` calls.
- Escaped the previously-raw breadcrumb `part`s, `formatted_score`, and result `name` in
  `get_result_header_html()`.
- Added regression tests in `src/components/lookup/v3/list_item.test.js` covering `escape_html`
  directly and `build_html` output for malicious heading/name, `item.key`, `collection_key`, and
  `path` (attribute-breakout and raw-markup injection cases).

---

## Categories reviewed and found clean

- **Dynamic code execution** (`eval`/`Function`/template injection): none. `sanitize_query()` only
  trims; query text never reaches an HTML or code sink.
- **Path traversal / arbitrary file read-write:** no direct vault path manipulation in `./src`;
  file access is delegated to smart-sources entities via `entity.read()`. Build/release scripts
  touch only fixed paths.
- **SSRF / arbitrary network requests:** no `fetch`/`requestUrl` in plugin code; all outbound
  navigation targets hardcoded `https://smartconnections.app/...`.
- **Command injection in build/release scripts:** `release.js`, `esbuild.js`, and
  `releases/run_format_release_notes.js` do not shell out (no `child_process`).
- **Secrets / hardcoded credentials:** none embedded. `.env` is used only by npm scripts
  (`--env-file`) at build/release time.
- **Prototype pollution:** no untrusted recursive merge / `__proto__`-reachable assignment in
  plugin code.
- **Insecure external links:** external links open to fixed HTTPS hosts; no attacker-controlled
  `window.name`/`opener` reuse.

## Informational

- `package.json` pins `"obsidian": "latest"` (a mutable tag). It is the official API package,
  marked `external` in `esbuild.js` (not bundled at runtime), so runtime risk is negligible — but
  pin an exact version for reproducible builds.

---

**Bottom line:** One high-severity, high-confidence DOM XSS in the v3 list-item renderer — **now
fixed and covered by regression tests**; the rest of the plugin is clean across the reviewed
categories.
