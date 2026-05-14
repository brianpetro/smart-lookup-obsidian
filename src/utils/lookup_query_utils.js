const DEFAULT_DEBOUNCE_MS = 300;

/**
 * @callback DebouncedSubmitHandler
 * @param {string} value
 * @returns {void|Promise<void>}
 */

/**
 * @typedef {((value: string) => void) & {cancel: () => void}} DebouncedSubmit
 */

/**
 * @param {DebouncedSubmitHandler} handler
 * @param {number} delay
 * @returns {DebouncedSubmit}
 */
export function create_debounced_submit(handler, delay = DEFAULT_DEBOUNCE_MS) {
  /** @type {number|undefined} */
  let timeout_id;
  const delay_ms = Number.isFinite(delay) && delay >= 0
    ? delay
    : DEFAULT_DEBOUNCE_MS
  ;
  /** @type {DebouncedSubmit} */
  const schedule = (value) => {
    if (timeout_id) window.clearTimeout(timeout_id);
    timeout_id = window.setTimeout(() => {
      timeout_id = undefined;
      void handler(value);
    }, delay_ms);
  };
  schedule.cancel = () => {
    if (timeout_id) {
      window.clearTimeout(timeout_id);
      timeout_id = undefined;
    }
  };
  return schedule;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function sanitize_query(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}
