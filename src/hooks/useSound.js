import { useCallback, useEffect, useRef, useState } from 'react';

const audioConstructor = () =>
  typeof window === 'undefined' ? null : window.AudioContext || window.webkitAudioContext || null;

/** A short foreground completion chime; enabling sound requires a user gesture. */
export function useSound() {
  const [supported] = useState(() => Boolean(audioConstructor()));
  const [enabled, setEnabled] = useState(false);
  const context = useRef(null);
  const active = useRef(false);
  const requested = useRef(false);
  const mounted = useRef(true);
  const generation = useRef(0);

  const toggle = useCallback(async () => {
    const thisGeneration = ++generation.current;
    if (requested.current) {
      requested.current = false;
      active.current = false;
      setEnabled(false);
      return;
    }
    const Constructor = audioConstructor();
    if (!Constructor) return;
    requested.current = true;
    try {
      if (!context.current || context.current.state === 'closed') context.current = new Constructor();
      await context.current.resume();
      if (!mounted.current || thisGeneration !== generation.current) return;
      active.current = context.current.state === 'running';
      requested.current = active.current;
      setEnabled(active.current);
    } catch {
      if (mounted.current && thisGeneration === generation.current) {
        active.current = false;
        requested.current = false;
        setEnabled(false);
      }
    }
  }, []);

  const playFinished = useCallback(() => {
    const audio = context.current;
    if (!active.current || !audio || audio.state !== 'running' || document.hidden) return false;
    try {
      const now = audio.currentTime;
      // Three gentle notes, short enough to avoid covering the visual alert.
      [660, 830.61, 987.77].forEach((frequency, index) => {
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        const start = now + index * 0.21;
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.15, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);
        oscillator.connect(gain);
        gain.connect(audio.destination);
        oscillator.onended = () => {
          oscillator.disconnect();
          gain.disconnect();
        };
        oscillator.start(start);
        oscillator.stop(start + 0.2);
      });
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current += 1;
      active.current = false;
      requested.current = false;
      const audio = context.current;
      context.current = null;
      if (audio && audio.state !== 'closed') audio.close().catch(() => {});
    };
  }, []);

  return { enabled, toggle, playFinished, supported };
}
