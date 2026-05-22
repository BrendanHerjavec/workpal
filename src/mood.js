// Wellness scoring + mood mapping + evolution logic.

export function computeWellness({ unreadEmails, overdueTasks, todaysCompletedTasks, focusMinutes }, bonus = 0) {
  let score = 70 + bonus;

  // Unread email penalties
  if (unreadEmails > 100) score -= 60;
  else if (unreadEmails > 50) score -= 35;
  else if (unreadEmails > 20) score -= 15;
  else if (unreadEmails > 5) score -= 5;

  // Overdue task penalties
  if (overdueTasks > 10) score -= 50;
  else if (overdueTasks > 5) score -= 25;
  else if (overdueTasks > 3) score -= 12;
  else if (overdueTasks > 0) score -= 4;

  // Bonuses
  score += Math.min(20, todaysCompletedTasks * 3);
  score += Math.min(20, Math.floor(focusMinutes / 15));

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function moodFromScore(score) {
  if (score <= 15) return 'dying';
  if (score <= 40) return 'sad';
  if (score <= 60) return 'neutral';
  if (score <= 85) return 'happy';
  return 'thriving';
}

// Context-aware sub-emotion. Takes precedence over base mood when present.
// Returns one of: loved, caffeinated, sleepy, panicked, bored, focused — or null.
export function subEmotion({ raw, activeBuffs, recentlyPetted, hour }) {
  if (recentlyPetted) return 'loved';
  if (raw.unreadEmails > 100 && raw.overdueTasks > 10) return 'panicked';
  if (activeBuffs?.some(b => b.id === 'coffee')) return 'caffeinated';
  if (hour >= 23 || hour < 6) return 'sleepy';
  if (raw.focusMinutes >= 180 && raw.todaysCompletedTasks >= 3) return 'focused';
  if (raw.unreadEmails === 0 && raw.overdueTasks === 0 && raw.todaysCompletedTasks === 0 && raw.focusMinutes === 0) return 'bored';
  return null;
}

export const STAGES = ['Egg', 'Blob', 'Sprout', 'Junior', 'Senior', 'Executive'];

// Returns updated stats object given today's score and the previous stats.
export function tickEvolution(stats, score, today) {
  const next = { ...stats, history: [...(stats.history || [])] };

  // Avoid double-ticking the same calendar day.
  if (next.lastTickDate === today) {
    // Update today's score in history if it exists, else append.
    const idx = next.history.findIndex(h => h.date === today);
    if (idx >= 0) next.history[idx] = { date: today, score };
    else next.history.push({ date: today, score });
    next.history = next.history.slice(-30);
    return next;
  }

  next.lastTickDate = today;
  next.history.push({ date: today, score });
  next.history = next.history.slice(-30);

  const goodDay = score >= 65;
  const badDay = score <= 30;

  if (goodDay) {
    next.goodDays = (next.goodDays || 0) + 1;
    next.badDaysInARow = 0;
    next.deathDays = 0;
    // Evolve every 3 cumulative good days, capped at Executive.
    const targetStage = Math.min(STAGES.length - 1, Math.floor(next.goodDays / 3));
    if (targetStage > next.stage) next.stage = targetStage;
  } else if (badDay) {
    next.badDaysInARow = (next.badDaysInARow || 0) + 1;
    if (next.badDaysInARow >= 2 && next.stage > 0) {
      next.stage = Math.max(0, next.stage - 1);
      next.badDaysInARow = 0; // reset so it stings once per regression
    }
    if (score <= 5) next.deathDays = (next.deathDays || 0) + 1;
    else next.deathDays = 0;
  } else {
    next.badDaysInARow = 0;
    next.deathDays = 0;
  }

  return next;
}

export function isDead(stats) {
  return (stats.deathDays || 0) >= 3;
}

// Passive-aggressive lines, chosen by mood.
const LINES = {
  dying: [
    "I think I see the light.",
    "Don't worry about me. Or do.",
    "Inbox zero is also a place we can go someday."
  ],
  sad: [
    "Those 12 overdue tasks aren't going to do themselves.",
    "Just a friendly nudge from the void.",
    "I noticed. Just so you know."
  ],
  neutral: [
    "Steady as she goes.",
    "Could be worse. Could be better.",
    "Mid is a vibe."
  ],
  happy: [
    "Inbox zero is a journey, not a destination.",
    "Look at you, functioning.",
    "Productivity smells like espresso today."
  ],
  thriving: [
    "Are you... okay? This is amazing.",
    "Linear is shaking.",
    "Executive material. Allegedly."
  ],
  loved: [ "Yes. More of that.", "I felt that.", "Validated.", "💖" ],
  caffeinated: [ "I can taste sound.", "Locked in. Don't talk to me.", "Time is fake. Tasks are real." ],
  sleepy: [ "It is bed o'clock.", "Tomorrow you. Tomorrow problem.", "*yawns at your overdue tasks*" ],
  panicked: [ "We need to talk.", "This is fine. (It is not fine.)", "I see the inbox. I see all of it." ],
  bored: [ "Are we... working?", "Awaiting input from a human.", "Idle is a choice." ],
  focused: [ "Flow state achieved. Do not disturb.", "We are *cooking*.", "Hours? More like minutes." ]
};

export function pickLine(mood, seed = Date.now()) {
  const arr = LINES[mood] || LINES.neutral;
  return arr[Math.floor(seed / 1000) % arr.length];
}

export function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
