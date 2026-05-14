const DEFAULT_DEBOUNCE_MS = 300;

/**
 * @param {Function} handler
 * @param {number} delay
 * @returns {Function & {cancel?: Function}}
 */
export function create_debounced_submit(handler, delay = DEFAULT_DEBOUNCE_MS) {
  let timeout_id;
  const schedule = (value) => {
    if (timeout_id) window.clearTimeout(timeout_id);
    timeout_id = window.setTimeout(() => {
      timeout_id = undefined;
      handler(value);
    }, delay);
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
