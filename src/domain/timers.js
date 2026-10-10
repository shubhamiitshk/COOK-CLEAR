/** Countdown values derive from a deadline, not the number of browser ticks. */
export function getRemainingMs(timer, now = Date.now()) {
  if (!timer || !Number.isFinite(timer.durationMs)) return 0;
  if (timer.status === 'ready') return Math.max(0, timer.durationMs);
  if (timer.status !== 'running' || !Number.isFinite(timer.deadlineAt)) return 0;
  return Math.max(0, Math.min(timer.durationMs, timer.deadlineAt - now));
}

export function formatTime(ms) {
  const seconds = Math.ceil(Math.max(0, Number.isFinite(ms) ? ms : 0) / 1000);
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
