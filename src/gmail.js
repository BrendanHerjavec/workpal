// Gmail OAuth (installed-app loopback flow) + unread-count fetcher.
// Runs in the Electron main process. No external OAuth library — just node http.
//
// Setup (one-time, by user):
//   1. console.cloud.google.com → New Project → Enable "Gmail API"
//   2. "OAuth consent screen" → External → add your own email as a Test user
//   3. "Credentials" → Create Credentials → OAuth Client ID → type "Desktop app"
//   4. Copy the Client ID and Client Secret into the app (right-click pet → Connect Gmail…)

const http = require('http');
const https = require('https');
const { URL } = require('url');
const { shell, safeStorage } = require('electron');

const SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

function postForm(url, params) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams(params).toString();
    const u = new URL(url);
    const req = https.request({
      method: 'POST', hostname: u.hostname, path: u.pathname,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode >= 400) return reject(new Error(json.error_description || json.error || `HTTP ${res.statusCode}`));
          resolve(json);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function getJSON(url, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      method: 'GET', hostname: u.hostname, path: u.pathname + u.search,
      headers: { 'Authorization': `Bearer ${token}` }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode >= 400) return reject(new Error(json.error?.message || `HTTP ${res.statusCode}`));
          resolve(json);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// --- Token storage helpers (encrypted with OS keychain if available) ---

function encryptString(s) {
  if (safeStorage.isEncryptionAvailable()) return safeStorage.encryptString(s).toString('base64');
  return Buffer.from(s, 'utf8').toString('base64');
}
function decryptString(b64) {
  if (!b64) return null;
  const buf = Buffer.from(b64, 'base64');
  if (safeStorage.isEncryptionAvailable()) {
    try { return safeStorage.decryptString(buf); } catch { return null; }
  }
  return buf.toString('utf8');
}

// --- OAuth loopback flow ---

function startLoopback() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const u = new URL(req.url, `http://127.0.0.1`);
      if (u.pathname !== '/oauth2callback') {
        res.writeHead(404); res.end(); return;
      }
      const code = u.searchParams.get('code');
      const err = u.searchParams.get('error');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<html><body style="font-family:system-ui;text-align:center;padding:40px"><h2>${err ? '❌ Failed' : '✅ Connected'}</h2><p>You can close this window and return to WorkPal.</p></body></html>`);
      server.close();
      if (err) reject(new Error(err));
      else if (code) resolve(code);
      else reject(new Error('No code in callback'));
    });
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve.port = port;
      // Resolve only after we get the code, but the port needs to be exposed before then.
      // We hack around this by returning the server reference too.
    });
    server.on('error', reject);
    // expose port via a hack: replace returned promise pattern
    setTimeout(() => {
      if (server.listening) {
        const port = server.address().port;
        resolve.__port = port;
      }
    }, 0);
  });
}

// Cleaner: split the loopback into two steps.
function listen() {
  return new Promise((resolveListen, rejectListen) => {
    let codePromise;
    const server = http.createServer((req, res) => {
      const u = new URL(req.url, `http://127.0.0.1`);
      if (u.pathname !== '/oauth2callback') {
        res.writeHead(404); res.end(); return;
      }
      const code = u.searchParams.get('code');
      const err = u.searchParams.get('error');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<html><body style="font-family:system-ui;text-align:center;padding:40px;color:#333"><h2>${err ? '❌ Failed' : '✅ Connected to WorkPal'}</h2><p>You can close this tab.</p></body></html>`);
      server.close();
      if (err) codePromise.reject(new Error(err));
      else if (code) codePromise.resolve(code);
      else codePromise.reject(new Error('No code in callback'));
    });
    server.on('error', rejectListen);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      const p = new Promise((resolve, reject) => { codePromise = { resolve, reject }; });
      resolveListen({ port, code: p, close: () => server.close() });
    });
  });
}

async function connect(store, { clientId, clientSecret }) {
  if (!clientId || !clientSecret) throw new Error('Missing clientId/clientSecret');

  const { port, code: codePromise } = await listen();
  const redirectUri = `http://127.0.0.1:${port}/oauth2callback`;

  const authUrl = `${AUTH_URL}?${new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent'
  })}`;

  await shell.openExternal(authUrl);

  // Wait up to 5 minutes for the callback.
  const code = await Promise.race([
    codePromise,
    new Promise((_, rej) => setTimeout(() => rej(new Error('OAuth timed out')), 300000))
  ]);

  const tokens = await postForm(TOKEN_URL, {
    code, client_id: clientId, client_secret: clientSecret,
    redirect_uri: redirectUri, grant_type: 'authorization_code'
  });

  if (!tokens.refresh_token) throw new Error('No refresh token returned. Revoke previous WorkPal access in your Google Account and retry.');

  store.set('gmail.clientId', encryptString(clientId));
  store.set('gmail.clientSecret', encryptString(clientSecret));
  store.set('gmail.refreshToken', encryptString(tokens.refresh_token));
  return true;
}

function disconnect(store) {
  store.delete('gmail.refreshToken');
  store.delete('gmail.accessToken');
}

function isConnected(store) {
  return !!store.get('gmail.refreshToken');
}

let cachedAccessToken = null;
let accessTokenExpiry = 0;

async function getAccessToken(store) {
  if (cachedAccessToken && Date.now() < accessTokenExpiry - 60_000) return cachedAccessToken;
  const clientId = decryptString(store.get('gmail.clientId'));
  const clientSecret = decryptString(store.get('gmail.clientSecret'));
  const refreshToken = decryptString(store.get('gmail.refreshToken'));
  if (!clientId || !clientSecret || !refreshToken) throw new Error('Not connected to Gmail');
  const t = await postForm(TOKEN_URL, {
    client_id: clientId, client_secret: clientSecret,
    refresh_token: refreshToken, grant_type: 'refresh_token'
  });
  cachedAccessToken = t.access_token;
  accessTokenExpiry = Date.now() + (t.expires_in || 3600) * 1000;
  return cachedAccessToken;
}

async function getInboxStats(store) {
  const token = await getAccessToken(store);
  // INBOX label has a messagesUnread counter — one call, very cheap.
  const inbox = await getJSON('https://gmail.googleapis.com/gmail/v1/users/me/labels/INBOX', token);
  return { unreadEmails: inbox.messagesUnread ?? 0 };
}

module.exports = { connect, disconnect, isConnected, getInboxStats };
