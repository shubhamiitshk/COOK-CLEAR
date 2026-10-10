import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import recipe from './data/recipe.js';
import { createSession, restoreSession, serializeSession, sessionReducer, STORAGE_KEY } from './domain/session.js';
import { formatTime, getRemainingMs } from './domain/timers.js';
import { useVoice } from './hooks/useVoice.js';
import { useWakeLock } from './hooks/useWakeLock.js';
import { useSound } from './hooks/useSound.js';
import { Icon } from './Icons.jsx';

function initialSession() {
  const requested = new URLSearchParams(location.search).get('demo') === '1' ? 'demo' : 'normal';
  try { return restoreSession(localStorage.getItem(STORAGE_KEY), requested, Date.now()) || createSession(requested); }
  catch { return createSession(requested); }
}

const QUANTITY = /(\d+(?:\.\d+)?\s(?:g|kg|ml|l|tbsp|tsp|cloves?|minutes?)\b)/g;
/** Keeps a number and its unit on one line and gives the quantity extra weight. */
function Instruction({ text }) {
  return text.split(QUANTITY).map((part, i) => i % 2 ? <strong className="qty" key={i}>{part}</strong> : part);
}

function ConfirmRestart({ mode, onConfirm, onClose }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className="restart-dialog" onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === e.currentTarget) onClose(); }} aria-labelledby="restart-title">
    <span className="dialog-icon"><Icon name="restart" size={28} /></span>
    <h2 id="restart-title">A fresh start?</h2>
    <p>This clears your current steps and timers. {mode === 'demo' ? 'The new session uses shorter demo timers.' : 'The new session uses the recipe timings.'}</p>
    <div className="dialog-actions"><button className="button subtle" onClick={onClose} autoFocus>Keep cooking</button><button className="button primary" onClick={onConfirm}>Start fresh</button></div>
  </dialog>;
}

function TimerCard({ timer, now, onStart, onAcknowledge, current, canStart }) {
  const running = timer.status === 'running', elapsed = timer.status === 'elapsed', done = timer.status === 'acknowledged';
  const remaining = running ? getRemainingMs(timer, now) : timer.status === 'ready' ? timer.durationMs : 0;
  const percent = running ? Math.max(0, Math.min(100, (1 - remaining / timer.durationMs) * 100)) : elapsed || done ? 100 : 0;
  return <section className={`timer-card ${timer.status} ${current ? 'current-task' : ''}`} aria-label={`${timer.label} timer`}>
    <div className="timer-top"><span className="timer-name"><Icon name={timer.id === 'pasta' ? 'bowl' : 'leaf'} size={21} />{timer.label}</span><span className="timer-state">{running ? <><i className="status-dot"/>Cooking</> : elapsed ? 'Check now' : done ? 'Checked' : 'Ready'}</span></div>
    <div className="timer-number" aria-label={running ? `${timer.label} time remaining` : `${timer.label} duration`}>{elapsed ? 'Finished' : done ? <><Icon name="check" size={28} /> All checked</> : formatTime(remaining)}</div>
    <div className="timer-progress" aria-hidden="true"><span style={{ width: `${percent}%` }} /></div>
    {timer.status === 'ready' ? canStart ? <button className="timer-action" onClick={() => onStart(timer.id)}><Icon name="clock" size={21}/><span>Start {timer.label.toLowerCase()} timer</span></button> : <div className="timer-footer">Not started in this session</div>
      : elapsed ? <button className="timer-action acknowledge" onClick={() => onAcknowledge(timer.id)}><Icon name="check" size={22}/><span>I've checked the {timer.label.toLowerCase()}</span></button>
      : <div className="timer-footer"><Icon name={done ? 'check' : 'clock'} size={16}/>{done ? 'You’re all set' : 'Keeps running as you move on'}</div>}
  </section>;
}

function Overview({ session, onStart, onMode, onReset }) {
  const started = session.status !== 'ready';
  return <main className="overview">
    <div className="recipe-story">
      <span className="eyebrow"><Icon name="leaf" size={17}/> A SIMPLE TWO-PAN DINNER</span>
      <h1>Tomato &<br/><em>basil pasta.</em></h1>
      <p className="recipe-description">A little less touch.<br/>A little more room to cook.</p>
      <div className="recipe-facts"><span><Icon name="clock" size={18}/>{recipe.totalMinutes} minutes</span><span><Icon name="bowl" size={19}/>Serves {recipe.servings}</span><span>6 clear steps</span></div>
      <div className="recipe-art"><img src={recipe.heroImage} alt="Tomato and basil pasta" className="hero-food-image" /><span className="art-note">Simple ingredients.<br/>Something lovely.</span><div className="basil-note"><Icon name="leaf" size={16}/>Fresh & familiar</div></div>
    </div>
    <div className="prep-panel">
      <div className="prep-heading"><span className="eyebrow">BEFORE YOU BEGIN</span><h2>A calmer counter.</h2><p>Keep your ingredients nearby. We’ll take it one step at a time.</p></div>
      <div className="ingredients"><div className="section-label"><h3>What you’ll need</h3><span>FOR TWO</span></div>{recipe.ingredients.map((item, i) => <div className="ingredient" key={item.name}><span className="ingredient-bullet">{String(i + 1).padStart(2, '0')}</span><span>{item.name}</span><strong>{item.quantity}</strong></div>)}</div>
      <div className="mode-control"><div><strong>Quick demo</strong><p>Try the flow with 20s and 35s timers.</p></div><button className={`switch ${session.mode === 'demo' ? 'on' : ''}`} role="switch" aria-checked={session.mode === 'demo'} aria-label="Quick demo with shorter timers" onClick={() => onMode(session.mode === 'demo' ? 'normal' : 'demo')}><span/></button></div>
      <button className="button primary start-cooking" onClick={onStart}>{started ? 'Continue your session' : 'Let’s start cooking'}<Icon name="arrow" size={26}/></button>
      <p className="start-note"><Icon name="check" size={14}/>Big controls. Clear steps. Your own pace.</p>
      {started && <button className="text-button reset-overview" onClick={onReset}><Icon name="restart" size={16}/>Start a fresh session</button>}
    </div>
  </main>;
}

export default function App() {
  const [session, dispatch] = useReducer(sessionReducer, undefined, initialSession);
  const [view, setView] = useState(() => session.status === 'ready' ? 'overview' : 'cook');
  const [now, setNow] = useState(Date.now());
  const [resetMode, setResetMode] = useState(null);
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const sessionRef = useRef(session); sessionRef.current = session;
  const navigationAt = useRef(0);
  const announcedTimers = useRef(new Set());
  const { enabled: soundEnabled, toggle: toggleSound, playFinished } = useSound();
  const currentStep = recipe.steps[session.stepIndex];
  const timers = Object.values(session.timers);
  const activeCount = timers.filter(t => t.status === 'running').length;
  const alerts = timers.filter(t => t.status === 'elapsed').sort((a, b) => a.deadlineAt - b.deadlineAt);
  const wake = useWakeLock(view === 'cook' && (session.status === 'cooking' || activeCount > 0));

  const move = useCallback(direction => {
    if (sessionRef.current.status !== 'cooking') return;
    const stamp = Date.now();
    if (stamp - navigationAt.current < 450) return;
    navigationAt.current = stamp;
    if (direction === 'next' && sessionRef.current.stepIndex === recipe.steps.length - 1) {
      dispatch({ type: 'COMPLETE' });
      setAnnouncement('Your recipe steps are complete. Check your food and timers before serving.');
    }
    else {
      const index = Math.max(0, Math.min(recipe.steps.length - 1, sessionRef.current.stepIndex + (direction === 'next' ? 1 : -1)));
      dispatch({ type: direction === 'next' ? 'NEXT' : 'PREVIOUS' });
      setAnnouncement(`Step ${index + 1}. ${recipe.steps[index].title}.`);
    }
  }, []);
  const voice = useVoice({ onNext: () => move('next'), onPrevious: () => move('previous'), getInstruction: () => {
    const step = recipe.steps[sessionRef.current.stepIndex];
    return `Step ${sessionRef.current.stepIndex + 1}. ${step.title}. ${step.instruction}`;
  } });

  useEffect(() => {
    const tick = () => { const stamp = Date.now(); setNow(stamp); dispatch({ type: 'TICK', now: stamp }); };
    const interval = setInterval(tick, 250);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', tick); };
  }, []);
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, serializeSession(session)); }
    catch { setStorageUnavailable(true); }
  }, [session]);
  useEffect(() => {
    const url = new URL(location.href);
    if (session.mode === 'demo') url.searchParams.set('demo', '1');
    else url.searchParams.delete('demo');
    history.replaceState(history.state, '', url);
  }, [session.mode]);
  useEffect(() => {
    const newlyFinished = Object.values(session.timers).filter(timer => timer.status === 'elapsed' && !announcedTimers.current.has(timer.id));
    if (newlyFinished.length) {
      newlyFinished.forEach(timer => announcedTimers.current.add(timer.id));
      setAnnouncement(`${newlyFinished.map(timer => timer.label).join(' and ')} ${newlyFinished.length > 1 ? 'timers' : 'timer'} finished. Check your food.`);
      if (!document.hidden) playFinished();
    }
  }, [session.timers, playFinished]);
  useEffect(() => { if (view !== 'cook') voice.disable(); }, [view]);
  useEffect(() => {
    if (!showHelp) return;
    const closeOnEscape = event => { if (event.key === 'Escape') setShowHelp(false); };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [showHelp]);

  const begin = () => { dispatch({ type: 'START_COOKING' }); setView('cook'); setShowHelp(false); };
  const reset = mode => {
    voice.disable(); announcedTimers.current.clear(); navigationAt.current = 0;
    dispatch({ type: 'RESET', mode, now: Date.now() }); setView('overview'); setResetMode(null); setAnnouncement('New session ready.');
  };
  const changeMode = mode => { if (session.status === 'ready') reset(mode); else setResetMode(mode); };
  const startTimer = timerId => {
    if (sessionRef.current.status !== 'cooking') return;
    const timer = sessionRef.current.timers[timerId];
    if (timer.status !== 'ready') return;
    dispatch({ type: 'START_TIMER', timerId, now: Date.now() }); setAnnouncement(`${timer.label} timer started.`);
  };
  const acknowledge = timerId => { dispatch({ type: 'ACK_TIMER', timerId, now: Date.now() }); setAnnouncement(`${session.timers[timerId].label} timer acknowledged.`); };

  return <div className={`app-shell ${view === 'cook' ? 'cooking-shell' : 'overview-shell'}`}>
    <header className="app-header">
      <button className="brand" onClick={() => setView('overview')} aria-label="CookClear recipe overview"><span className="brand-symbol"><Icon name="bowl" size={25}/></span><span>cook<span className="brand-light">clear</span><span className="brand-period">.</span></span></button>
      <div className="header-center">{session.mode === 'demo' ? <span className="demo-badge"><Icon name="spark" size={14}/>QUICK DEMO · SHORTER TIMERS</span> : <span className="mode-badge"><i/>YOUR KITCHEN, A LITTLE CALMER</span>}</div>
      <div className="header-actions">{activeCount > 0 && <span className="active-timer-badge"><Icon name="clock" size={16}/>{activeCount} running</span>}<button className="header-button sound-button" onClick={toggleSound} aria-label={`Sound ${soundEnabled ? 'on' : 'off'}`} aria-pressed={soundEnabled}><Icon name={soundEnabled ? 'sound' : 'mute'} size={20}/><span>Sound {soundEnabled ? 'on' : 'off'}</span></button><button className="icon-button" onClick={() => setShowHelp(x => !x)} aria-label="How CookClear works" aria-expanded={showHelp}><Icon name="info" size={21}/></button></div>
    </header>
    {showHelp && <aside className="help-panel"><div><strong>A little help, always nearby.</strong><p>Use the large buttons to move through steps. Start each timer when its task begins; timers keep running when you go back or open the overview. Keep this page open for visible alerts.</p><p>Voice, when available: “next step,” “previous step,” “read step.” Elbow comfort and distant reading depend on your device and setup.</p></div><button className="icon-button" onClick={() => setShowHelp(false)} aria-label="Close help"><Icon name="close"/></button></aside>}
    {storageUnavailable && <div className="capability-note" role="status">Your session works here, but this browser cannot save it after a refresh.</div>}
    {view === 'overview' && alerts.length > 0 && <aside className="overview-timer-alert"><Icon name="clock" size={24}/><div><strong>{alerts.map(timer => timer.label).join(' & ')} {alerts.length > 1 ? 'timers have' : 'timer has'} finished.</strong><span>Check your food, then acknowledge the timer.</span></div><button className="button" onClick={() => setView('cook')}>View timers<Icon name="arrow" size={20}/></button></aside>}
    {view === 'overview' ? <Overview session={session} onStart={begin} onMode={changeMode} onReset={() => setResetMode(session.mode)}/>
      : <main className="cooking-workspace">
        <section className="step-panel" aria-labelledby="step-title">
          <div className="step-meta"><button className="text-button overview-link" onClick={() => setView('overview')}><Icon name="back" size={17}/>Recipe overview</button><span className="recipe-small">Tomato & basil pasta</span></div>
          <div className="step-progress"><span className="eyebrow">{session.status === 'complete' ? 'A MOMENT TO ENJOY' : `STEP ${String(session.stepIndex + 1).padStart(2, '0')} / ${String(recipe.steps.length).padStart(2, '0')}`}</span><div className="progress-dots" aria-hidden="true">{recipe.steps.map((_, i) => <span key={i} className={i < session.stepIndex || session.status === 'complete' ? 'done' : i === session.stepIndex ? 'active' : ''}/>)}</div></div>
          {session.status === 'complete' ? <div className="step-copy completion-copy"><span className="completion-icon"><Icon name="check" size={38}/></span><h1 id="step-title">A lovely finish.</h1><p className="instruction">Your steps are complete.<br/>Check the food and your timers before serving.</p><div className="completion-visual"><img src={recipe.heroImage} alt="Finished tomato basil pasta" className="step-image" /></div><p className="completion-note">Any running timers stay right here until you’ve checked them.</p></div> : <div className="step-main" key={currentStep.id}>
            <div className="step-content">
              <div className="step-copy"><h1 id="step-title">{currentStep.title}<span className="title-period">.</span></h1><p className="instruction"><Instruction text={currentStep.instruction}/></p><div className="step-ingredients">{currentStep.ingredients.map(item => <span key={item}>{item}</span>)}</div></div>
              <div className="cook-tip"><span className="tip-icon"><Icon name="leaf" size={21}/></span><div><span className="tip-label">A LITTLE KITCHEN NOTE</span><p>{currentStep.tip}</p></div></div>
            </div>
            {currentStep.image && <div className="step-visual"><img src={currentStep.image} alt={currentStep.title} className="step-image"/><span className="step-visual-caption">Step {session.stepIndex + 1} of {recipe.steps.length}</span></div>}
          </div>}
          <div className="step-controls">{session.status === 'complete' ? <button className="button primary finish-button" onClick={() => setResetMode(session.mode)}><Icon name="restart" size={26}/>Start a fresh session</button> : <><button className="button previous" onClick={() => move('previous')} disabled={session.stepIndex === 0}><Icon name="back" size={25}/><span>Previous step</span></button><button className="button primary next" onClick={() => move('next')}><span>{session.stepIndex === recipe.steps.length - 1 ? 'Finish the steps' : 'Next step'}</span><Icon name={session.stepIndex === recipe.steps.length - 1 ? 'check' : 'arrow'} size={28}/></button></>}</div>
          <div className="step-bottom-note"><span>Move at your own pace.</span><span><Icon name="check" size={13}/>Your progress is saved{storageUnavailable ? ' for this session' : ''}</span></div>
        </section>
        <aside className="timer-rail" aria-label="Your cooking timers">
          <div className="rail-heading"><div><span className="eyebrow">A LITTLE LESS TO REMEMBER</span><h2>Your timers<span>.</span></h2></div><Icon name="clock" size={26}/></div>
          <p className="rail-description">Two pans. Each with its own rhythm.</p>
          {timers.map(timer => <TimerCard timer={timer} now={now} onStart={startTimer} onAcknowledge={acknowledge} current={currentStep.timerId === timer.id} canStart={session.status === 'cooking'} key={timer.id}/>)}
          <div className={`timer-status-message ${alerts.length ? 'needs-attention' : ''}`}><Icon name={alerts.length ? 'info' : 'check'} size={18}/><span>{alerts.length ? `${alerts[0].label} is ready for a check.${alerts.length > 1 ? ` ${alerts[1].label}, too.` : ''}` : activeCount ? 'Your timers keep going across steps.' : session.status === 'complete' ? 'Check both pans before serving.' : 'Start a timer when its task begins.'}</span></div>
          <div className="voice-panel"><div className="voice-title"><span><Icon name="mic" size={18}/>Hands-free help</span><span className={`voice-status ${voice.status}`}><i/>{({off:'Off',requesting:'Connecting',listening:'Listening',reading:'Reading',paused:'Paused',cooldown:'Connecting',error:'Unavailable',unsupported:'Unsupported'})[voice.status] || 'Off'}</span></div><p>{voice.status === 'listening' ? 'Say “next step,” “previous step,” or “read step.”' : voice.status === 'reading' ? 'Reading this step aloud. Listening resumes after.' : 'Three simple commands, when your hands are busy.'}</p><button className="voice-button" onClick={voice.enabled ? voice.disable : voice.enable} disabled={!voice.supported}><Icon name={voice.enabled ? 'stop' : 'mic'} size={18}/>{voice.enabled ? 'Stop voice' : voice.supported ? voice.status === 'paused' ? 'Resume voice' : 'Enable voice' : 'Use the step buttons'}</button>{voice.error && <p className="voice-error" role="status">{voice.error}</p>}{!voice.enabled && voice.supported && <span className="voice-privacy">Uses your microphone; may need internet.</span>}</div>
          <div className="wake-note"><Icon name="sun" size={14}/><span>{wake.status === 'active' ? 'Keeping your screen awake' : 'Keep your screen on while cooking'}</span></div>
        </aside>
      </main>}
    <footer className="app-footer"><span>Less scrolling. More cooking.</span><span>COOKCLEAR · A DESIGN EXPLORATION</span><a href="/case-study.pdf" target="_blank" rel="noreferrer"><Icon name="book" size={14}/>Case study</a></footer>
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</div>
    {resetMode && <ConfirmRestart mode={resetMode} onClose={() => setResetMode(null)} onConfirm={() => reset(resetMode)}/>}
  </div>;
}
