import test from 'node:test';
import assert from 'node:assert/strict';
import { getRemainingMs, formatTime } from '../src/domain/timers.js';

test('remaining time derives from wall-clock deadlines and clamps elapsed timers at zero', () => {
  const timer = { durationMs: 600_000, deadlineAt: 601_000, status: 'running' };
  assert.equal(getRemainingMs(timer, 1_000), 600_000);
  // The UI's sampled clock can precede a just-started timer by a few milliseconds.
  assert.equal(getRemainingMs(timer, 750), 600_000);
  assert.equal(getRemainingMs(timer, 598_900), 2_100);
  assert.equal(getRemainingMs(timer, 900_000), 0);
  assert.equal(getRemainingMs({ ...timer, status: 'ready' }, 900_000), 600_000);
  assert.equal(getRemainingMs({ ...timer, status: 'elapsed' }, 1_000), 0);
  assert.equal(getRemainingMs({ ...timer, status: 'acknowledged' }, 1_000), 0);
});

test('countdown rounds remaining fractional seconds up and handles empty values', () => {
  assert.equal(formatTime(600_000), '10:00');
  assert.equal(formatTime(35_000), '00:35');
  assert.equal(formatTime(59_001), '01:00');
  assert.equal(formatTime(1), '00:01');
  assert.equal(formatTime(0), '00:00');
  assert.equal(formatTime(-20), '00:00');
  assert.equal(formatTime(Number.NaN), '00:00');
});
