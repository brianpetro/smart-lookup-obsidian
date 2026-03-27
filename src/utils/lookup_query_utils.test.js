import test from 'ava';
import { sanitize_query, create_debounced_submit } from './lookup_query_utils.js';

test('sanitize_query trims strings and rejects non-strings', (t) => {
  t.is(sanitize_query('  hello world  '), 'hello world');
  t.is(sanitize_query(''), '');
  t.is(sanitize_query(null), '');
  t.is(sanitize_query(undefined), '');
  t.is(sanitize_query(42), '');
});

test('create_debounced_submit executes latest queued value only', async (t) => {
  const calls = [];
  const submit = create_debounced_submit((value) => {
    calls.push(value);
  }, 5);

  submit('first');
  submit('second');

  await new Promise((resolve) => setTimeout(resolve, 20));

  t.deepEqual(calls, ['second']);
});

test('create_debounced_submit cancel prevents scheduled invocation', async (t) => {
  const calls = [];
  const submit = create_debounced_submit((value) => {
    calls.push(value);
  }, 10);

  submit('will-cancel');
  submit.cancel();

  await new Promise((resolve) => setTimeout(resolve, 25));

  t.deepEqual(calls, []);
});
