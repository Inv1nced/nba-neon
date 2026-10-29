import assert from 'node:assert/strict';
import { getJSON, dataFreshness, combineFreshness, scoreboard } from '../js/api.js';
import { freshnessNote, dateControls } from '../js/ui.js';
const realFetch = globalThis.fetch;
const realNow = Date.now;
let now = 100000, calls = 0, failing = false;
Date.now = () => now;
globalThis.fetch = async () => {
  calls++;
  if (failing) throw new Error('offline');
  return { ok: true, json: async () => ({ day: { date: '2026-06-03' }, events: [] }) };
};
try {
  const first = await scoreboard('20260603');
  assert.deepEqual(first.freshness, { fetchedAt: 100000, stale: false });
  now += 1000;
  assert.deepEqual((await scoreboard('20260603')).freshness, first.freshness);
  assert.equal(calls, 1, 'fresh cache avoids a network request');
  now += 30000; failing = true;
  const cached = await scoreboard('20260603');
  assert.deepEqual(cached.freshness, { fetchedAt: 100000, stale: true });
  assert.equal(first.freshness.stale, false, 'previous snapshots remain unchanged');
  assert.match(freshnessNote(cached.freshness), /устаревшими/);
  assert.equal(calls, 4, 'all three network routes fail before cached fallback');
  await assert.rejects(getJSON('https://example.test/uncached'), /offline/);
  failing = false; now += 1000;
  const recovered = await scoreboard('20260603');
  assert.deepEqual(recovered.freshness, { fetchedAt: now, stale: false });
  assert.deepEqual(combineFreshness([first.freshness, recovered.freshness], true), { fetchedAt: 100000, stale: true });
  assert.match(dateControls('20260203'), /value="2026-02-03"/);
  console.log('PASS: cache timestamp, stale fallback, uncached failure, recovery, partial data, date control');
} finally { globalThis.fetch = realFetch; Date.now = realNow; }
