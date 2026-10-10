import { recipe } from '../data/recipe.js';

export const STORAGE_KEY = 'cookclear.session.v1';
export const SESSION_VERSION = 1;
const MODES = new Set(['normal', 'demo']);
const SESSION_STATUSES = new Set(['ready', 'cooking', 'complete']);
const TIMER_STATUSES = new Set(['ready', 'running', 'elapsed', 'acknowledged']);
const DEMO_DURATIONS = { pasta: 20_000, sauce: 35_000 };

const validTime = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const actionTime = action => validTime(action.now) ? action.now : Date.now();
const normalizeMode = mode => MODES.has(mode) ? mode : 'normal';

export function createSession(mode = 'normal', now = Date.now()) {
  const selectedMode = normalizeMode(mode);
  const createdAt = validTime(now) ? now : Date.now();
  return {
    version: SESSION_VERSION,
    recipeId: recipe.id,
    mode: selectedMode,
    status: 'ready',
    stepIndex: 0,
    createdAt,
    timers: Object.fromEntries(recipe.timers.map(timer => [timer.id, {
      ...timer,
      durationMs: selectedMode === 'demo' ? DEMO_DURATIONS[timer.id] : timer.durationMs,
      status: 'ready',
      startedAt: null,
      deadlineAt: null,
      acknowledgedAt: null,
    }])),
  };
}

function settleTimers(state, now) {
  let changed = false;
  const timers = Object.fromEntries(Object.entries(state.timers).map(([id, timer]) => {
    if (timer.status === 'running' && timer.deadlineAt <= now) {
      changed = true;
      return [id, { ...timer, status: 'elapsed' }];
    }
    return [id, timer];
  }));
  return changed ? { ...state, timers } : state;
}

export function sessionReducer(state, action) {
  switch (action.type) {
    case 'START_COOKING':
      return state.status === 'ready' ? { ...state, status: 'cooking' } : state;
    case 'NEXT':
      return state.status === 'cooking' && state.stepIndex < recipe.steps.length - 1
        ? { ...state, stepIndex: state.stepIndex + 1 }
        : state;
    case 'PREVIOUS':
      return state.status === 'cooking' && state.stepIndex > 0
        ? { ...state, stepIndex: state.stepIndex - 1 }
        : state;
    case 'START_TIMER': {
      const timer = state.timers[action.timerId];
      if (!timer || timer.status !== 'ready' || state.status !== 'cooking') return state;
      const now = actionTime(action);
      return {
        ...state,
        timers: {
          ...state.timers,
          [timer.id]: { ...timer, status: 'running', startedAt: now, deadlineAt: now + timer.durationMs },
        },
      };
    }
    case 'TICK':
      return settleTimers(state, actionTime(action));
    case 'ACK_TIMER': {
      const now = actionTime(action);
      const settledState = settleTimers(state, now);
      const timer = settledState.timers[action.timerId];
      if (!timer || timer.status !== 'elapsed') return settledState;
      return {
        ...settledState,
        timers: {
          ...settledState.timers,
          [timer.id]: { ...timer, status: 'acknowledged', acknowledgedAt: now },
        },
      };
    }
    case 'COMPLETE':
      return state.status === 'cooking' ? { ...state, status: 'complete' } : state;
    case 'RESET':
      return createSession(action.mode ?? state.mode, actionTime(action));
    default:
      return state;
  }
}

export function serializeSession(state) {
  return JSON.stringify(state);
}

/** Invalid or incompatible data is discarded instead of guessing timer states. */
export function restoreSession(raw, mode = 'normal', now = Date.now()) {
  if (!MODES.has(mode) || !validTime(now)) return null;
  let saved;
  try {
    saved = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)
    || saved.version !== SESSION_VERSION || saved.recipeId !== recipe.id
    || saved.mode !== mode || !SESSION_STATUSES.has(saved.status)
    || !Number.isInteger(saved.stepIndex) || saved.stepIndex < 0 || saved.stepIndex >= recipe.steps.length
    || !validTime(saved.createdAt) || !saved.timers || typeof saved.timers !== 'object'
    || Array.isArray(saved.timers)) return null;

  const base = createSession(mode, saved.createdAt);
  if (Object.keys(saved.timers).length !== recipe.timers.length) return null;
  const restoredTimers = {};
  for (const template of Object.values(base.timers)) {
    const timer = saved.timers[template.id];
    if (!timer || timer.id !== template.id || timer.label !== template.label
      || timer.durationMs !== template.durationMs || !TIMER_STATUSES.has(timer.status)) return null;

    if (timer.status === 'ready') {
      if (timer.startedAt !== null || timer.deadlineAt !== null || timer.acknowledgedAt !== null) return null;
    } else {
      if (!validTime(timer.startedAt) || !validTime(timer.deadlineAt)
        || timer.deadlineAt !== timer.startedAt + template.durationMs) return null;
      if (timer.status === 'acknowledged') {
        if (!validTime(timer.acknowledgedAt) || timer.acknowledgedAt < timer.deadlineAt) return null;
      } else if (timer.acknowledgedAt !== null) return null;
    }
    restoredTimers[template.id] = {
      ...template,
      status: timer.status,
      startedAt: timer.startedAt,
      deadlineAt: timer.deadlineAt,
      acknowledgedAt: timer.acknowledgedAt,
    };
  }
  if (saved.status === 'ready' && (saved.stepIndex !== 0
    || Object.values(restoredTimers).some(timer => timer.status !== 'ready'))) return null;

  return settleTimers({ ...base, status: saved.status, stepIndex: saved.stepIndex, timers: restoredTimers }, now);
}
