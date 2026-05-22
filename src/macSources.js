// Main-process helpers that read Mail.app and Reminders.app via AppleScript.
// First run triggers a macOS Automation permission prompt for each app.
// If denied or not on macOS, callers should fall back gracefully.

const { exec } = require('child_process');

function run(script, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    exec(`osascript -e ${JSON.stringify(script)}`, { timeout: timeoutMs }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr?.toString() || err.message));
      resolve(stdout.toString().trim());
    });
  });
}

async function num(script) {
  const out = await run(script);
  const n = parseInt(out, 10);
  return Number.isFinite(n) ? n : 0;
}

async function mailUnread() {
  // Sum unread across all accounts' INBOX mailboxes.
  return num(`
    tell application "Mail"
      set total to 0
      repeat with acct in accounts
        try
          set total to total + (unread count of (mailbox "INBOX" of acct))
        on error
          try
            repeat with mbx in mailboxes of acct
              try
                set total to total + (unread count of mbx)
              end try
            end repeat
          end try
        end try
      end repeat
      return total
    end tell
  `);
}

async function remindersOverdue() {
  return num(`
    tell application "Reminders"
      set total to 0
      repeat with l in lists
        try
          set total to total + (count of (reminders of l whose completed is false and due date is not missing value and due date < (current date)))
        end try
      end repeat
      return total
    end tell
  `);
}

async function remindersCompletedToday() {
  return num(`
    tell application "Reminders"
      set todayStart to current date
      set hours of todayStart to 0
      set minutes of todayStart to 0
      set seconds of todayStart to 0
      set total to 0
      repeat with l in lists
        try
          set total to total + (count of (reminders of l whose completed is true and completion date is not missing value and completion date >= todayStart))
        end try
      end repeat
      return total
    end tell
  `);
}

async function getMacStats() {
  if (process.platform !== 'darwin') {
    return { unreadEmails: 0, overdueTasks: 0, todaysCompletedTasks: 0, focusMinutes: 0, error: 'not macOS' };
  }
  const result = { unreadEmails: 0, overdueTasks: 0, todaysCompletedTasks: 0, focusMinutes: 0 };
  const errors = [];

  await Promise.all([
    mailUnread().then(v => result.unreadEmails = v).catch(e => errors.push('Mail: ' + e.message)),
    remindersOverdue().then(v => result.overdueTasks = v).catch(e => errors.push('Reminders overdue: ' + e.message)),
    remindersCompletedToday().then(v => result.todaysCompletedTasks = v).catch(e => errors.push('Reminders done: ' + e.message))
  ]);

  if (errors.length) result.error = errors.join(' | ');
  return result;
}

module.exports = { getMacStats };
