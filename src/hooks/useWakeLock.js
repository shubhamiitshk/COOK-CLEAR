import { useEffect, useState } from 'react';

/** Keep the active cooking screen awake when the browser permits it. */
export function useWakeLock(active) {
  const [supported] = useState(() => typeof navigator !== 'undefined' && Boolean(navigator.wakeLock?.request));
  const [status, setStatus] = useState(supported ? 'off' : 'unsupported');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!supported || !active) {
      setStatus(supported ? 'off' : 'unsupported');
      setError('');
      return undefined;
    }
    let disposed = false;
    let pending = false;
    let sentinel = null;
    let reacquireAfterPending = false;

    const acquire = async () => {
      if (disposed || document.hidden || pending || (sentinel && !sentinel.released)) return;
      pending = true;
      setStatus('requesting');
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (disposed || document.hidden) {
          await lock.release();
          return;
        }
        sentinel = lock;
        setStatus('active');
        setError('');
        lock.addEventListener('release', () => {
          if (sentinel !== lock) return;
          sentinel = null;
          if (!disposed) setStatus(document.hidden ? 'paused' : 'released');
          // Reacquire only on visibility changes, not an unbounded release loop.
        });
      } catch {
        if (!disposed) {
          setStatus('unavailable');
          setError('Keep-awake is unavailable. Your device may still dim or lock.');
        }
      } finally {
        pending = false;
        if (reacquireAfterPending && !disposed && !document.hidden) {
          reacquireAfterPending = false;
          acquire();
        }
      }
    };

    const onVisibility = () => {
      if (document.hidden) {
        setStatus('paused');
        const lock = sentinel;
        sentinel = null;
        if (lock && !lock.released) lock.release().catch(() => {});
      } else {
        if (pending) reacquireAfterPending = true;
        acquire();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    acquire();
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisibility);
      const lock = sentinel;
      sentinel = null;
      if (lock && !lock.released) lock.release().catch(() => {});
    };
  }, [active, supported]);

  return { supported, status, error };
}
