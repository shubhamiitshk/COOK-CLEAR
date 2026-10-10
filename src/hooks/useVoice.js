import { useCallback, useEffect, useRef, useState } from 'react';

const COMMANDS = new Set(['next step', 'previous step', 'read step']);
const COOLDOWN_MS = 1400;

const recognitionConstructor = () =>
  typeof window === 'undefined'
    ? null
    : window.SpeechRecognition || window.webkitSpeechRecognition || null;

/** Optional, explicitly enabled voice navigation. Never changes a timer. */
export function useVoice({ onNext, onPrevious, getInstruction }) {
  const [supported] = useState(() => Boolean(recognitionConstructor()));
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState(supported ? 'off' : 'unsupported');
  const [lastCommand, setLastCommand] = useState('');
  const [error, setError] = useState('');
  const callbacks = useRef({ onNext, onPrevious, getInstruction });
  const actions = useRef({});
  callbacks.current = { onNext, onPrevious, getInstruction };

  useEffect(() => {
    const Constructor = recognitionConstructor();
    let recognition = null;
    let disposed = false;
    let active = false;
    let starting = false;
    let running = false;
    let reading = false;
    let utterance = null;
    let restartTimer = null;
    let cooldownTimer = null;
    let lastAcceptedAt = 0;
    let sessionStartedAt = 0;
    let restartTimes = [];
    const seenResults = new Set();

    const clearTimers = () => {
      clearTimeout(restartTimer);
      clearTimeout(cooldownTimer);
      restartTimer = null;
      cooldownTimer = null;
    };

    const abortRecognition = () => {
      if (!recognition || (!running && !starting)) return;
      try {
        recognition.abort();
      } catch {
        // A browser may already have ended recognition between events.
        running = false;
        starting = false;
      }
    };

    const cancelReading = () => {
      if (utterance) {
        utterance.onend = null;
        utterance.onerror = null;
        window.speechSynthesis?.cancel();
      }
      utterance = null;
      reading = false;
    };

    const pause = (nextStatus = 'off') => {
      active = false;
      clearTimers();
      cancelReading();
      abortRecognition();
      if (!disposed) {
        setEnabled(false);
        setStatus(nextStatus);
      }
    };

    const fail = (message) => {
      pause('error');
      if (!disposed) setError(message);
    };

    const start = () => {
      if (disposed || !active || reading || document.hidden || running || starting || !recognition) return;
      clearTimeout(restartTimer);
      restartTimer = null;
      seenResults.clear();
      starting = true;
      sessionStartedAt = Date.now();
      setStatus('requesting');
      try {
        recognition.start();
      } catch {
        starting = false;
        fail('Voice could not start. Check browser microphone access, then enable voice again.');
      }
    };

    const scheduleStart = () => {
      if (disposed || !active || reading || document.hidden) return;
      clearTimeout(restartTimer);
      restartTimer = setTimeout(start, 500);
    };

    const readStep = () => {
      if (disposed) return;
      if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
        setError('Read aloud is unavailable in this browser. The instruction remains on screen.');
        return;
      }
      const instruction = String(callbacks.current.getInstruction?.() || '').trim();
      if (!instruction) return;
      clearTimers();
      cancelReading();
      reading = true;
      // Stop the microphone first so the spoken instruction cannot issue commands.
      abortRecognition();
      setError('');
      setStatus('reading');
      utterance = new window.SpeechSynthesisUtterance(instruction);
      utterance.lang = 'en-US';
      utterance.rate = 0.95;
      const finished = (failed = false) => {
        if (disposed || !reading) return;
        reading = false;
        utterance = null;
        if (failed) setError('Read aloud stopped. You can read the instruction on screen.');
        setStatus(active ? 'requesting' : supported ? 'off' : 'unsupported');
        scheduleStart();
      };
      utterance.onend = () => finished();
      utterance.onerror = () => finished(true);
      try {
        window.speechSynthesis.speak(utterance);
      } catch {
        finished(true);
      }
    };

    if (Constructor) {
      try {
        recognition = new Constructor();
        recognition.lang = 'en-US';
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
          starting = false;
          running = true;
          if (!active || reading || document.hidden) {
            abortRecognition();
            return;
          }
          if (!disposed) setStatus('listening');
        };

        recognition.onresult = (event) => {
          if (disposed || !active || reading || document.hidden) return;
          for (let index = event.resultIndex; index < event.results.length; index += 1) {
            const result = event.results[index];
            if (!result.isFinal || seenResults.has(index)) continue;
            seenResults.add(index);
            const command = result[0].transcript.toLowerCase().trim().replace(/[.!?]+$/, '').replace(/\s+/g, ' ');
            const now = Date.now();
            if (!COMMANDS.has(command) || now - lastAcceptedAt < COOLDOWN_MS) continue;
            lastAcceptedAt = now;
            restartTimes = [];
            setLastCommand(command);
            setError('');
            if (command === 'read step') {
              readStep();
              break;
            }
            if (command === 'next step') callbacks.current.onNext?.();
            if (command === 'previous step') callbacks.current.onPrevious?.();
            setStatus('cooldown');
            clearTimeout(cooldownTimer);
            cooldownTimer = setTimeout(() => {
              if (!disposed && active && !reading && !document.hidden) {
                setStatus(running ? 'listening' : 'requesting');
              }
            }, COOLDOWN_MS);
          }
        };

        recognition.onerror = (event) => {
          if (disposed || !active || reading || event.error === 'aborted') return;
          if (event.error === 'no-speech') return; // onend handles bounded restarts.
          const messages = {
            'not-allowed': 'Microphone access was denied. Allow microphone access in your browser, then enable voice.',
            'service-not-allowed': 'This browser does not allow speech recognition here. Use the on-screen controls.',
            'audio-capture': 'No microphone is available. Use the on-screen controls.',
            network: 'Speech recognition could not connect. Check your connection, then enable voice again.',
            'language-not-supported': 'English speech recognition is unavailable in this browser.',
          };
          fail(messages[event.error] || 'Voice stopped. Use the on-screen controls or enable voice again.');
        };

        recognition.onend = () => {
          running = false;
          starting = false;
          if (disposed || !active || reading || document.hidden) return;
          const now = Date.now();
          if (now - sessionStartedAt > 10000) restartTimes = [];
          restartTimes = restartTimes.filter((time) => now - time < 30000);
          if (restartTimes.length >= 3) {
            fail('Voice paused after repeated interruptions. Tap enable voice to try again.');
            return;
          }
          restartTimes.push(now);
          setStatus('requesting');
          scheduleStart();
        };
      } catch {
        recognition = null;
        setStatus('error');
        setError('This browser could not initialize speech recognition. Use the on-screen controls.');
      }
    }

    actions.current = {
      enable: () => {
        if (!recognition) return;
        if (document.hidden) {
          setError('Return to the cooking tab before enabling voice.');
          return;
        }
        if (active) return;
        setError('');
        restartTimes = [];
        lastAcceptedAt = 0;
        active = true;
        setEnabled(true);
        if (reading) return;
        start();
        // A previous abort may still be ending; onend will resume safely.
      },
      disable: () => pause('off'),
      readStep,
    };

    const onVisibility = () => {
      if (document.hidden && (active || reading)) {
        pause('paused');
        setError('Voice paused while this tab was hidden. Enable voice to resume.');
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      disposed = true;
      active = false;
      clearTimers();
      cancelReading();
      if (recognition) {
        recognition.onstart = null;
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
        abortRecognition();
      }
      document.removeEventListener('visibilitychange', onVisibility);
      actions.current = {};
    };
  }, [supported]);

  const enable = useCallback(() => actions.current.enable?.(), []);
  const disable = useCallback(() => actions.current.disable?.(), []);
  const readStep = useCallback(() => actions.current.readStep?.(), []);
  return { supported, status, enabled, lastCommand, error, enable, disable, readStep };
}
