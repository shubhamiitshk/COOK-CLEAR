import test from 'node:test';
import assert from 'node:assert/strict';
import { recipe } from '../src/data/recipe.js';
import { createSession, sessionReducer, restoreSession, serializeSession } from '../src/domain/session.js';

const at = 1_000_000;
const cooking = (mode = 'demo') => sessionReducer(createSession(mode, at), { type: 'START_COOKING' });
const start = (state, timerId, now = at) => sessionReducer(state, { type: 'START_TIMER', timerId, now });

test('independent timer deadlines survive late browser callbacks and expire separately', () => {
  let state = start(cooking(), 'pasta');
  state = start(state, 'sauce', at + 1_000);
  state = sessionReducer(state, { type: 'TICK', now: at + 21_000 });
  assert.equal(state.timers.pasta.status, 'elapsed');
  assert.equal(state.timers.sauce.status, 'running');
  assert.equal(state.timers.sauce.deadlineAt, at + 36_000);
  state = sessionReducer(state, { type: 'TICK', now: at + 90_000 });
  assert.equal(state.timers.pasta.status, 'elapsed');
  assert.equal(state.timers.sauce.status, 'elapsed');
});

test('duplicate starts cannot reset a running timer or a finished timer', () => {
  const state = start(cooking(), 'pasta');
  assert.equal(start(state, 'pasta', at + 5_000), state);
  const elapsed = sessionReducer(state, { type: 'TICK', now: at + 20_000 });
  assert.equal(start(elapsed, 'pasta', at + 25_000), elapsed);
});

test('acknowledging one elapsed timer leaves the other elapsed alert available', () => {
  const state = start(start(cooking(), 'pasta'), 'sauce');
  const acknowledged = sessionReducer(state, { type: 'ACK_TIMER', timerId: 'pasta', now: at + 40_000 });
  assert.equal(acknowledged.timers.pasta.status, 'acknowledged');
  assert.equal(acknowledged.timers.pasta.acknowledgedAt, at + 40_000);
  assert.equal(acknowledged.timers.sauce.status, 'elapsed');
});

test('navigation is bounded and does not change running timer deadlines', () => {
  let state = start(cooking(), 'pasta');
  state = sessionReducer(state, { type: 'PREVIOUS' });
  assert.equal(state.stepIndex, 0);
  for (let count = 0; count < 20; count++) state = sessionReducer(state, { type: 'NEXT' });
  assert.equal(state.stepIndex, recipe.steps.length - 1);
  assert.equal(state.timers.pasta.deadlineAt, at + 20_000);
  state = sessionReducer(state, { type: 'PREVIOUS' });
  assert.equal(state.stepIndex, recipe.steps.length - 2);
});

test('completion retains active timers and they can still expire and be acknowledged', () => {
  const state = sessionReducer(start(cooking(), 'pasta'), { type: 'COMPLETE' });
  assert.equal(state.status, 'complete');
  assert.equal(state.timers.pasta.status, 'running');
  const elapsed = sessionReducer(state, { type: 'TICK', now: at + 21_000 });
  assert.equal(elapsed.timers.pasta.status, 'elapsed');
  const acknowledged = sessionReducer(elapsed, { type: 'ACK_TIMER', timerId: 'pasta', now: at + 22_000 });
  assert.equal(acknowledged.status, 'complete');
  assert.equal(acknowledged.timers.pasta.status, 'acknowledged');
});

test('restoration uses original deadlines, including when both timers expired while absent', () => {
  const state = start(start(cooking(), 'pasta'), 'sauce', at + 1_000);
  const resumed = restoreSession(serializeSession(state), 'demo', at + 10_000);
  assert.equal(resumed.timers.pasta.deadlineAt, at + 20_000);
  assert.equal(resumed.timers.sauce.deadlineAt, at + 36_000);
  const late = restoreSession(serializeSession(state), 'demo', at + 90_000);
  assert.equal(late.timers.pasta.status, 'elapsed');
  assert.equal(late.timers.sauce.status, 'elapsed');
});

test('restoration rejects invalid JSON, incompatible modes, wrong recipes, invalid bounds and tampered deadlines', () => {
  assert.equal(restoreSession('{broken', 'demo', at), null);
  assert.equal(restoreSession('null', 'demo', at), null);
  assert.equal(restoreSession(serializeSession(cooking()), 'normal', at), null);
  assert.equal(restoreSession(serializeSession(cooking()), 'unsupported', at), null);
  for (const patch of [
    { recipeId: 'another-recipe' },
    { version: 99 },
    { stepIndex: -1 },
    { stepIndex: recipe.steps.length },
    { status: 'unknown' },
    { timers: {} },
  ]) assert.equal(restoreSession(serializeSession({ ...cooking(), ...patch }), 'demo', at), null);
  const tampered = start(cooking(), 'pasta');
  tampered.timers.pasta.deadlineAt += 100;
  assert.equal(restoreSession(serializeSession(tampered), 'demo', at), null);
});

test('reset clears recipe progress and all timer history and applies selected mode', () => {
  const active = sessionReducer(start(cooking(), 'pasta'), { type: 'NEXT' });
  const reset = sessionReducer(active, { type: 'RESET', mode: 'normal', now: at + 10_000 });
  assert.equal(reset.status, 'ready');
  assert.equal(reset.stepIndex, 0);
  assert.equal(reset.mode, 'normal');
  assert.equal(reset.timers.pasta.durationMs, 600_000);
  assert.equal(reset.timers.sauce.durationMs, 360_000);
  for (const timer of Object.values(reset.timers)) {
    assert.equal(timer.status, 'ready');
    assert.equal(timer.deadlineAt, null);
    assert.equal(timer.startedAt, null);
  }
});
