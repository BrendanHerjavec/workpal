import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { getStats } from './productivitySource.js';
import { computeWellness, moodFromScore, subEmotion, tickEvolution, STAGES, isDead, pickLine, todayKey } from './mood.js';
import { spriteSVG, stageScale } from './sprite.js';

const e = React.createElement;

function Sprite({ stage, mood, onClick, jiggle }) {
  const html = spriteSVG(stage, mood);
  const dragState = useRef(null);

  const onMouseDown = useCallback(async (ev) => {
    if (ev.button !== 0) return;
    ev.preventDefault();
    ev.stopPropagation();
    const [winX, winY] = await window.workpal.getWindowPosition();
    dragState.current = {
      startScreenX: ev.screenX,
      startScreenY: ev.screenY,
      winX,
      winY,
      moved: false
    };
    const onMove = (mv) => {
      const s = dragState.current;
      if (!s) return;
      const dx = mv.screenX - s.startScreenX;
      const dy = mv.screenY - s.startScreenY;
      if (!s.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
      s.moved = true;
      window.workpal.setWindowPosition(s.winX + dx, s.winY + dy);
    };
    const onUp = (up) => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      const s = dragState.current;
      dragState.current = null;
      if (s && !s.moved) onClick?.(up);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [onClick]);

  return e('div', {
    onMouseDown,
    className: `no-drag anim-${mood} ${jiggle ? 'jiggle' : ''} cursor-pointer`,
    style: { ['--s']: stageScale(stage), width: 128, height: 128, pointerEvents: 'auto' },
    dangerouslySetInnerHTML: { __html: html }
  });
}

function Confetti() {
  const pieces = Array.from({ length: 12 }, (_, i) => i);
  const colors = ['#ffd700','#ff80ab','#80d8ff','#b9f6ca','#ffab40'];
  return e('div', { className: 'confetti absolute inset-0 pointer-events-none' },
    pieces.map(i => e('span', {
      key: i,
      style: {
        left: `${10 + i*7}%`,
        top: '20%',
        background: colors[i % colors.length],
        ['--dx']: `${(i%2?1:-1) * (10 + i*4)}px`,
        animationDelay: `${(i*0.07).toFixed(2)}s`
      }
    }))
  );
}

function Hearts({ items }) {
  return e('div', { className: 'pointer-events-none absolute inset-0' },
    items.map(it => e('div', {
      key: it.id,
      className: 'heart absolute text-pink-400',
      style: { left: `${it.x}%`, top: `${it.y}%`, fontSize: '18px' }
    }, '♥'))
  );
}

function WellnessBar({ score }) {
  const color = score > 65 ? 'bg-emerald-400' : score > 40 ? 'bg-amber-400' : 'bg-rose-500';
  return e('div', { className: 'w-full h-2 bg-slate-700/60 rounded-full overflow-hidden' },
    e('div', { className: `h-full ${color} transition-all`, style: { width: `${score}%` } })
  );
}

function StatsPanel({ score, mood, stats, raw, history, bonus }) {
  const stage = STAGES[stats.stage];
  const hurts = [];
  if (raw.unreadEmails > 20) hurts.push(`${raw.unreadEmails} unread emails 😬`);
  if (raw.overdueTasks > 3) hurts.push(`${raw.overdueTasks} overdue tasks 🫠`);
  const helps = [];
  if (raw.todaysCompletedTasks > 0) helps.push(`${raw.todaysCompletedTasks} tasks done ✅`);
  if (raw.focusMinutes > 0) helps.push(`${raw.focusMinutes}m focus 🎯`);
  if (bonus > 0) helps.push(`+${bonus} care buff 💖`);

  return e('div', { className: 'no-drag bg-slate-900/90 text-slate-100 text-[11px] rounded-xl p-2 shadow-xl backdrop-blur w-full' },
    e('div', { className: 'flex justify-between items-center mb-1' },
      e('div', { className: 'font-semibold' }, `${stage} · ${mood}`),
      e('div', { className: 'opacity-70' }, `${score}/100`)
    ),
    e(WellnessBar, { score }),
    e('div', { className: 'mt-1.5 space-y-0.5' },
      hurts.map((h,i)=> e('div', { key:'h'+i, className: 'text-rose-300' }, h)),
      helps.map((h,i)=> e('div', { key:'g'+i, className: 'text-emerald-300' }, h)),
      hurts.length===0 && helps.length===0 && e('div', { className: 'opacity-60' }, 'Nothing to report.')
    ),
    e('div', { className: 'mt-1.5' },
      e('div', { className: 'opacity-60 mb-0.5' }, '7-day streak'),
      e('div', { className: 'flex gap-0.5 h-3' },
        Array.from({length:7}).map((_,i) => {
          const h = history[history.length - 7 + i];
          const s = h ? h.score : 0;
          const bg = !h ? 'bg-slate-700' : s > 65 ? 'bg-emerald-400' : s > 40 ? 'bg-amber-400' : 'bg-rose-500';
          return e('div', { key: i, className: `flex-1 rounded-sm ${bg}`, title: h ? `${h.date}: ${s}` : 'no data' });
        })
      )
    )
  );
}

function DebugPanel({ mock, onChange, onClose }) {
  const field = (key, label, max=200) => e('label', { className: 'flex items-center justify-between gap-2 text-[11px]' },
    e('span', { className: 'opacity-80 w-16' }, label),
    e('input', {
      type: 'range', min: 0, max, value: mock[key], className: 'flex-1 no-drag',
      onChange: (ev) => onChange({ ...mock, [key]: Number(ev.target.value) })
    }),
    e('span', { className: 'w-8 text-right tabular-nums' }, mock[key])
  );
  return e('div', { className: 'no-drag absolute inset-1 bg-slate-900/95 text-slate-100 rounded-xl p-3 shadow-2xl space-y-2 z-50' },
    e('div', { className: 'flex justify-between items-center' },
      e('div', { className: 'font-semibold text-xs' }, 'Debug · mock data'),
      e('button', { onClick: onClose, className: 'text-xs opacity-70 hover:opacity-100' }, '✕')
    ),
    field('unreadEmails', 'Unread', 300),
    field('overdueTasks', 'Overdue', 30),
    field('todaysCompletedTasks', 'Done today', 20),
    field('focusMinutes', 'Focus min', 480)
  );
}

function SpeechBubble({ text }) {
  return e('div', {
    key: text,
    className: 'bubble absolute top-1 left-2 right-2 bg-white text-slate-800 text-[11px] px-2 py-1.5 rounded-xl shadow-md text-center leading-snug',
    style: { wordBreak: 'break-word' }
  }, text);
}

function ActionBar({ onAction, cooldowns }) {
  const Btn = (id, emoji, label, tip) => {
    const cd = cooldowns[id] || 0;
    const disabled = cd > 0;
    return e('button', {
      key: id,
      title: disabled ? `${tip} (${cd}s)` : tip,
      disabled,
      onClick: () => onAction(id),
      className: `no-drag relative flex-1 py-1.5 rounded-lg text-[14px] transition ${disabled ? 'bg-slate-800/60 opacity-40 cursor-not-allowed' : 'bg-slate-800/80 hover:bg-slate-700 active:scale-95'}`
    },
      e('span', null, emoji),
      disabled && e('span', { className: 'absolute -top-1 -right-1 text-[9px] bg-slate-900 px-1 rounded' }, cd)
    );
  };
  return e('div', { className: 'no-drag w-full flex gap-1 mt-1' },
    Btn('pet',     '✋', 'Pet',         'Pet (+5 for 30s)'),
    Btn('feed',    '🍱', 'Feed',        'Feed (+10 for 60s)'),
    Btn('coffee',  '☕', 'Coffee',      'Coffee (+15 for 2m)'),
    Btn('inbox',   '📧', 'Inbox',       'Process 10 emails'),
    Btn('task',    '✅', 'Task',        'Log a completed task')
  );
}

// Buff config: id → { amount, durationSec, cooldownSec }
const BUFFS = {
  pet:    { amount: 5,  durationSec: 30,  cooldownSec: 10 },
  feed:   { amount: 10, durationSec: 60,  cooldownSec: 45 },
  coffee: { amount: 15, durationSec: 120, cooldownSec: 120 }
};

function App() {
  const [score, setScore] = useState(70);
  const [mood, setMood] = useState('neutral');
  const [raw, setRaw] = useState({ unreadEmails:0, overdueTasks:0, todaysCompletedTasks:0, focusMinutes:0 });
  const [stats, setStats] = useState({ goodDays:0, badDaysInARow:0, stage:0, history:[], deathDays:0, lastTickDate:null });
  const [settings, setSettings] = useState({ alwaysOnTop:true, paused:false, mockMode:true, demoMode:false, demoCycleSeconds:20, tasksPerEvolve:3, mock:{ unreadEmails:0, overdueTasks:0, todaysCompletedTasks:0, focusMinutes:0 } });
  const [demoTick, setDemoTick] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [bubble, setBubble] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [hearts, setHearts] = useState([]);
  const [jiggle, setJiggle] = useState(false);
  const [activeBuffs, setActiveBuffs] = useState([]); // [{id, amount, expiresAt}]
  const [cooldowns, setCooldowns] = useState({}); // id → secondsLeft
  const [pettedUntil, setPettedUntil] = useState(0);
  const [gmailConnected, setGmailConnected] = useState(false);
  const prevMood = useRef('neutral');
  const tickRef = useRef(0);

  // Initial load
  useEffect(() => {
    (async () => {
      const s = await window.workpal.storeGet('stats');
      const cfg = await window.workpal.storeGet('settings');
      if (s) setStats(s);
      if (cfg) setSettings(cfg);
      setGmailConnected(await window.workpal.gmail.isConnected());
    })();
  }, []);

  // Total active bonus from buffs
  const totalBonus = activeBuffs.reduce((acc, b) => acc + b.amount, 0);

  // Refresh stats loop (recomputes whenever buffs or mocks change)
  const refresh = useCallback(async () => {
    if (settings.paused) return;
    const r = await getStats();
    setRaw(r);
    const sc = computeWellness(r, totalBonus);
    setScore(sc);
    const m = moodFromScore(sc);
    setMood(m);

    const today = todayKey();
    setStats(prev => {
      const next = tickEvolution(prev, sc, today);
      window.workpal.storeSet('stats', next);
      return next;
    });
  }, [settings.paused, totalBonus]);

  useEffect(() => { refresh(); }, [refresh, settings.mock]);

  // Per-second tick: expire buffs, decrement cooldowns, periodic refresh
  useEffect(() => {
    const id = setInterval(() => {
      tickRef.current += 1;
      const now = Date.now();
      setActiveBuffs(prev => prev.filter(b => b.expiresAt > now));
      setCooldowns(prev => {
        const next = {};
        for (const [k, v] of Object.entries(prev)) {
          if (v - 1 > 0) next[k] = v - 1;
        }
        return next;
      });
      if (tickRef.current % 5 === 0) refresh();
      if (settings.demoMode) setDemoTick(t => t + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [refresh, settings.demoMode]);

  // Speech bubble + confetti
  useEffect(() => {
    if (prevMood.current !== mood) {
      if (prevMood.current !== 'thriving' && mood === 'thriving') {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 1400);
      }
      prevMood.current = mood;
    }
  }, [mood]);

  useEffect(() => {
    const showBubble = () => {
      setBubble(pickLine(mood, Date.now()));
      setTimeout(() => setBubble(null), 4800);
    };
    const id = setInterval(showBubble, 22000);
    const t = setTimeout(showBubble, 2500);
    return () => { clearInterval(id); clearTimeout(t); };
  }, [mood]);

  const popHearts = useCallback((count = 3) => {
    const newOnes = Array.from({ length: count }, (_, i) => ({
      id: `${Date.now()}-${i}-${Math.random()}`,
      x: 35 + Math.random()*30,
      y: 40 + Math.random()*20
    }));
    setHearts(h => [...h, ...newOnes]);
    setTimeout(() => {
      const ids = new Set(newOnes.map(n => n.id));
      setHearts(h => h.filter(x => !ids.has(x.id)));
    }, 1200);
  }, []);

  const applyBuff = useCallback((id) => {
    const def = BUFFS[id];
    if (!def) return;
    if (cooldowns[id]) return;
    setActiveBuffs(prev => [...prev.filter(b => b.id !== id), {
      id, amount: def.amount, expiresAt: Date.now() + def.durationSec * 1000
    }]);
    setCooldowns(prev => ({ ...prev, [id]: def.cooldownSec }));
  }, [cooldowns]);

  const onPet = useCallback(() => {
    if (cooldowns.pet) {
      // Allow petting visual even on cooldown, just no stacking buff.
      popHearts(2);
      setJiggle(true); setTimeout(() => setJiggle(false), 300);
      return;
    }
    applyBuff('pet');
    popHearts(4);
    setJiggle(true); setTimeout(() => setJiggle(false), 300);
    setPettedUntil(Date.now() + 3500);
    setBubble('Yes. More of that.');
    setTimeout(() => setBubble(null), 2500);
  }, [applyBuff, popHearts, cooldowns.pet]);

  // Clicking the pet pets him AND toggles the stats/action overlay.
  const onPetClick = useCallback(() => {
    setPanelOpen(o => !o);
    onPet();
  }, [onPet]);

  const onAction = useCallback(async (id) => {
    if (id === 'pet') { onPet(); return; }
    if (id === 'feed' || id === 'coffee') {
      applyBuff(id);
      popHearts(3);
      setBubble(id === 'feed' ? 'Mmm. Snack.' : 'Caffeinated. Locked in.');
      setTimeout(() => setBubble(null), 2500);
      return;
    }
    if (id === 'inbox') {
      // Only effective in mock mode; in real mode you'd open Gmail.
      if (settings.mockMode) {
        const nextMock = { ...settings.mock, unreadEmails: Math.max(0, (settings.mock.unreadEmails || 0) - 10) };
        const next = { ...settings, mock: nextMock };
        setSettings(next);
        await window.workpal.storeSet('settings', next);
        popHearts(2);
        setBubble('10 emails. Vanished.');
        setTimeout(() => setBubble(null), 2500);
      } else {
        setBubble('Open Gmail. I believe in you.');
        setTimeout(() => setBubble(null), 2500);
      }
      return;
    }
    if (id === 'task') {
      // Always count toward task-based evolution (demo-friendly).
      const threshold = Math.max(1, settings.tasksPerEvolve || 3);
      const cur = (stats.tasksTowardEvolve || 0) + 1;
      let nextStats;
      if (cur >= threshold && stats.stage < STAGES.length - 1) {
        nextStats = { ...stats, stage: stats.stage + 1, tasksTowardEvolve: 0 };
        setStats(nextStats);
        await window.workpal.storeSet('stats', nextStats);
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 1400);
        setBubble(`Evolved into ${STAGES[nextStats.stage]}!`);
        setTimeout(() => setBubble(null), 3000);
      } else {
        nextStats = { ...stats, tasksTowardEvolve: cur };
        setStats(nextStats);
        await window.workpal.storeSet('stats', nextStats);
        setBubble(`Task ${cur}/${threshold} toward next stage.`);
        setTimeout(() => setBubble(null), 2500);
      }
      if (settings.mockMode) {
        const nextMock = { ...settings.mock, todaysCompletedTasks: (settings.mock.todaysCompletedTasks || 0) + 1 };
        const next = { ...settings, mock: nextMock };
        setSettings(next);
        await window.workpal.storeSet('settings', next);
      }
      popHearts(2);
    }
  }, [onPet, applyBuff, popHearts, settings]);

  // Right-click menu
  const onContextMenu = (ev) => {
    ev.preventDefault();
    window.workpal.showMenu([
      { id: 'toggle-pause', label: settings.paused ? 'Resume' : 'Pause', type: 'checkbox', checked: settings.paused },
      { id: 'toggle-aot', label: 'Always on top', type: 'checkbox', checked: settings.alwaysOnTop },
      { id: 'toggle-real', label: 'Use real Mail + Reminders', type: 'checkbox', checked: !settings.mockMode },
      { id: 'toggle-demo', label: `Demo: cycle stages (${settings.demoCycleSeconds || 20}s each)`, type: 'checkbox', checked: !!settings.demoMode },
      ...[1, 3, 5, 10].map(n => ({ id: `tpe-${n}`, label: `Evolve every ${n} task${n>1?'s':''} (now ${stats.tasksTowardEvolve||0}/${settings.tasksPerEvolve||3})`, type: 'checkbox', checked: (settings.tasksPerEvolve||3) === n })),
      { id: gmailConnected ? 'gmail-disconnect' : 'gmail-connect', label: gmailConnected ? 'Disconnect Gmail' : 'Connect Gmail…' },
      { id: 'toggle-debug', label: 'Debug panel…' },
      ...STAGES.map((name, i) => ({ id: `set-stage-${i}`, label: `Set stage → ${name}`, type: 'checkbox', checked: stats.stage === i })),
      { id: 'revive', label: 'Revive pet' },
      { id: 'reset-egg', label: 'Reset to Egg (demo)' },
      { id: 'reset', label: 'Reset save (full wipe)' },
      { id: 'quit', label: 'Quit' }
    ]);
  };

  useEffect(() => {
    window.workpal.onMenuClick(async (id) => {
      if (id === 'toggle-pause') {
        const next = { ...settings, paused: !settings.paused };
        setSettings(next); await window.workpal.storeSet('settings', next);
      } else if (id === 'toggle-aot') {
        const next = { ...settings, alwaysOnTop: !settings.alwaysOnTop };
        setSettings(next); await window.workpal.setAlwaysOnTop(next.alwaysOnTop);
      } else if (id === 'toggle-real') {
        const next = { ...settings, mockMode: !settings.mockMode };
        setSettings(next); await window.workpal.storeSet('settings', next);
        refresh();
      } else if (id === 'gmail-connect') {
        const creds = await window.workpal.gmail.promptCreds();
        if (creds && creds.clientId && creds.clientSecret) {
          setBubble('Opening Google in your browser…');
          try {
            await window.workpal.gmail.connect(creds);
            setGmailConnected(true);
            setBubble('Gmail connected. I see everything now.');
            // Auto-flip to real-data mode if user hadn't already
            if (settings.mockMode) {
              const next = { ...settings, mockMode: false };
              setSettings(next); await window.workpal.storeSet('settings', next);
            }
            refresh();
          } catch (err) {
            setBubble('Gmail connect failed: ' + err.message);
          }
          setTimeout(() => setBubble(null), 5000);
        }
      } else if (id === 'gmail-disconnect') {
        await window.workpal.gmail.disconnect();
        setGmailConnected(false);
        setBubble('Gmail disconnected.');
        setTimeout(() => setBubble(null), 2500);
      } else if (id === 'toggle-demo') {
        const next = { ...settings, demoMode: !settings.demoMode };
        setSettings(next); await window.workpal.storeSet('settings', next);
        setDemoTick(0);
      } else if (id && id.startsWith('tpe-')) {
        const n = Number(id.slice(4));
        const next = { ...settings, tasksPerEvolve: n };
        setSettings(next); await window.workpal.storeSet('settings', next);
      } else if (id === 'toggle-debug') {
        setShowDebug(true);
      } else if (id && id.startsWith('set-stage-')) {
        const stage = Number(id.slice('set-stage-'.length));
        const next = { ...stats, stage, deathDays: 0 };
        setStats(next); await window.workpal.storeSet('stats', next);
      } else if (id === 'reset-egg') {
        const next = { goodDays:0, badDaysInARow:0, stage:0, history: stats.history || [], deathDays:0, lastTickDate:null, tasksTowardEvolve:0 };
        setStats(next); await window.workpal.storeSet('stats', next);
        setDemoTick(0);
        setBubble('Back to an egg. Demo me.');
        setTimeout(() => setBubble(null), 2500);
      } else if (id === 'revive') {
        const next = { ...stats, deathDays: 0, stage: Math.max(stats.stage, 1) };
        setStats(next); await window.workpal.storeSet('stats', next);
      } else if (id === 'reset') {
        const next = { goodDays:0, badDaysInARow:0, stage:0, history:[], deathDays:0, lastTickDate:null, tasksTowardEvolve:0 };
        setStats(next); await window.workpal.storeSet('stats', next);
      } else if (id === 'quit') {
        window.workpal.quit();
      }
    });
  }, [settings, stats, gmailConnected]);

  let demoStage = stats.stage;
  if (settings.demoMode) {
    const cycle = Math.max(2, settings.demoCycleSeconds || 20);
    const elapsedSec = Math.floor(demoTick);
    demoStage = Math.floor(elapsedSec / cycle) % STAGES.length;
  }
  const dead = isDead(stats);
  const sub = subEmotion({
    raw,
    activeBuffs,
    recentlyPetted: Date.now() < pettedUntil,
    hour: new Date().getHours()
  });
  const displayMood = dead ? 'dying' : (sub || mood);

  const onMockChange = async (mock) => {
    const next = { ...settings, mock };
    setSettings(next);
    await window.workpal.storeSet('settings', next);
  };

  return e('div', {
      className: 'w-screen h-screen p-2 flex flex-col items-center relative',
      onContextMenu
    },
    bubble && e(SpeechBubble, { text: bubble }),
    e('div', { className: 'drag flex-1 flex items-center justify-center relative w-full mt-6' },
      e(Sprite, { stage: demoStage, mood: displayMood, onClick: onPetClick, jiggle }),
      e(Hearts, { items: hearts }),
      showConfetti && e(Confetti, null)
    ),
    panelOpen && !showDebug && e(React.Fragment, null,
      e(StatsPanel, { score, mood: displayMood, stats, raw, history: stats.history || [], bonus: totalBonus }),
      e(ActionBar, { onAction, cooldowns })
    ),
    showDebug && e(DebugPanel, {
      mock: settings.mock || { unreadEmails:0, overdueTasks:0, todaysCompletedTasks:0, focusMinutes:0 },
      onChange: onMockChange,
      onClose: () => setShowDebug(false)
    })
  );
}

createRoot(document.getElementById('root')).render(e(App));
