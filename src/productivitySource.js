// productivitySource.js — swap this module out to wire in real data sources.
//
// Exposes:
//   getStats() => Promise<{ unreadEmails, overdueTasks, todaysCompletedTasks, focusMinutes }>
//
// The default implementation reads mock values from electron-store so the
// debug panel can adjust them at runtime. Replace the body of getStats()
// with calls to Gmail / Calendar / Linear / ClickUp clients when ready.
//
// TODO(integrations):
//   - Gmail API: count messages in INBOX with label UNREAD.
//     https://developers.google.com/gmail/api/reference/rest/v1/users.messages/list?q=is:unread
//   - Google Calendar: pull today's events to derive focus blocks vs meetings.
//   - Linear: list issues assigned to me with state != Done and dueDate < today.
//     https://developers.linear.app/docs/sdk/getting-started
//   - ClickUp: GET /api/v2/team/{team_id}/task?assignees[]=me&due_date_lt=now&statuses[]=open
//   - Local focus tracker (RescueTime / ActivityWatch): read today's focused-app minutes.
//
// Keep the return shape stable so the rest of the app does not need to change.

let lastReal = null;

export async function getStats() {
  const settings = await window.workpal.storeGet('settings');
  if (settings?.mockMode !== false) {
    return { ...settings.mock };
  }

  // Real-data mode: pull from macOS Mail.app + Reminders.app via main process.
  // If Gmail is connected, its unread count overrides Mail.app's.
  try {
    const real = await window.workpal.getRealStats();
    const { error, ...stats } = real || {};
    if (await window.workpal.gmail.isConnected()) {
      const g = await window.workpal.gmail.getStats();
      if (!g.error) stats.unreadEmails = g.unreadEmails;
    }
    lastReal = stats;
    return stats;
  } catch (err) {
    if (lastReal) return lastReal;
    return { unreadEmails: 0, overdueTasks: 0, todaysCompletedTasks: 0, focusMinutes: 0 };
  }
}
