/**
 * ui-shots.mjs — dependency-free UI screenshot harness (Chrome DevTools Protocol).
 *
 * Boots the installed Chrome in headless mode, signs in through the real API,
 * injects the JWT into localStorage, then captures PNGs of the key RoofPro CRM
 * screens. Used as launch evidence; no npm packages required (Node 20+ global
 * fetch + WebSocket).
 *
 * Usage:
 *   node scripts/ui-shots.mjs [--base http://localhost:3000] [--api http://localhost:5000]
 *                             [--out runs/shots] [--email demo@roofprocrm.com] [--password RoofPro!2026]
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const BASE = arg('--base', 'http://localhost:3000');
const API = arg('--api', 'http://localhost:5000');
const OUT = resolve(arg('--out', 'runs/shots'));
const EMAIL = arg('--email', 'demo@roofprocrm.com');
const PASSWORD = arg('--password', 'RoofPro!2026');
const DEBUG = args.includes('--debug');
const FULL = args.includes('--full');
const SCROLL = Number(arg('--scroll', '0')) || 0;
const ONLY = arg('--only', '');
const THEME = arg('--theme', 'light');
const EVAL = arg('--eval', '');
const PORT = 9222;
const VIEWPORT = { width: 1440, height: 900 };

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

function findBrowser() {
  for (const p of CHROME_CANDIDATES) {
    try {
      if (statSync(p).isFile()) return p;
    } catch {}
  }
  throw new Error('No Chrome/Edge binary found. Set CHROME_PATH.');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForJson(url, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(url);
      if (r.ok) return await r.json();
    } catch {}
    await sleep(250);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function login() {
  const r = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!r.ok) throw new Error(`login failed: HTTP ${r.status} ${await r.text()}`);
  const data = await r.json();
  if (!data.accessToken) throw new Error('login response missing accessToken');
  return data;
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.events = [];
    ws.addEventListener('message', (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.method === 'Network.responseReceived') {
        const url = msg.params?.response?.url || '';
        if (url.includes('/api/v1/ai/')) this.events.push(msg);
      } else if (msg.method && (msg.method.startsWith('Runtime.exception') || msg.method.startsWith('Log.'))) {
        this.events.push(msg);
      }
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message || 'CDP error'));
        else resolve(msg.result);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, 30000);
    });
  }
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const auth = await login();
  console.log(`[shots] authenticated as ${auth.user?.email} (${auth.user?.role})`);

  const browserPath = findBrowser();
  const profileDir = join(tmpdir(), `roofpro-shots-${Date.now()}`);
  mkdirSync(profileDir, { recursive: true });

  const child = spawn(
    browserPath,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--no-first-run',
      '--no-default-browser-check',
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${profileDir}`,
      `--window-size=${VIEWPORT.width},${VIEWPORT.height}`,
      'about:blank',
    ],
    { stdio: 'ignore', detached: false }
  );

  const cleanup = () => {
    try { child.kill(); } catch {}
    try { rmSync(profileDir, { recursive: true, force: true }); } catch {}
  };

  try {
    await waitForJson(`http://127.0.0.1:${PORT}/json/version`);
    const target = await (
      await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent('about:blank')}`, { method: 'PUT' })
    ).json();

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true });
      ws.addEventListener('error', rej, { once: true });
    });
    const cdp = new Cdp(ws);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Log.enable');
    await cdp.send('Network.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: VIEWPORT.width,
      height: VIEWPORT.height,
      deviceScaleFactor: 1,
      mobile: false,
    });

    async function saveShot(name) {
      const shot = await cdp.send('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: FULL,
      });
      const file = join(OUT, `${name}.png`);
      writeFileSync(file, Buffer.from(shot.data, 'base64'));
      console.log(`[shots] saved ${file}`);
    }

    async function setAuthAndNavigate(path, name, waitMs = 3500) {
      // The app persists auth in Zustand (`roofpro-auth`) AND raw tokens that the
      // axios interceptor reads. Seed both before reloading the protected route.
      const persistedUser = {
        ...(auth.user || {}),
        company: auth.company || auth.user?.company || undefined,
      };
      const persistedStore = JSON.stringify({
        state: {
          user: persistedUser,
          accessToken: auth.accessToken,
          refreshToken: auth.refreshToken || null,
          isAuthenticated: true,
          isLoading: false,
        },
        version: 0,
      });
      await cdp.send('Page.navigate', { url: `${BASE}${path}` });
      await sleep(1200);
      const injected = await cdp.send('Runtime.evaluate', {
        expression: `(() => {
          localStorage.setItem('roofpro-auth', ${JSON.stringify(persistedStore)});
          localStorage.setItem('accessToken', ${JSON.stringify(auth.accessToken)});
          localStorage.setItem('refreshToken', ${JSON.stringify(auth.refreshToken || '')});
          localStorage.setItem('roofpro.onboarding.v1', JSON.stringify({ version: 1, completed: true, skipped: true, lastStep: 0 }));
          localStorage.setItem('roofpro.install.dismissed', 'true');
          localStorage.setItem('theme', ${JSON.stringify(THEME)});
          return JSON.stringify({ href: location.href, keys: Object.keys(localStorage), store: (localStorage.getItem('roofpro-auth') || '').slice(0, 120) });
        })()`,
        returnByValue: true,
      });
      if (DEBUG) console.log(`[debug] injection @ ${path}:`, injected.result?.value);
      await cdp.send('Page.navigate', { url: `${BASE}${path}` });
      await sleep(waitMs);
      if (SCROLL > 0) {
        await cdp.send('Runtime.evaluate', {
          expression: `(() => {
            const main = document.querySelector('main');
            if (main) main.scrollTop = ${SCROLL};
            window.scrollTo(0, ${SCROLL});
            return true;
          })()`,
        });
        await sleep(900);
      }
      if (DEBUG) {
        const state = await cdp.send('Runtime.evaluate', {
          expression: `JSON.stringify({ href: location.href, title: document.title, text: (document.body && document.body.innerText || '').replace(/\\s+/g, ' ').slice(0, 160) })`,
          returnByValue: true,
        });
        console.log(`[debug] after nav ${path}:`, state.result?.value);
      }
      await saveShot(name);
    }

    // Public page first (no auth needed)
    await cdp.send('Page.navigate', { url: `${BASE}/login` });
    await sleep(2500);
    const loginShot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(OUT, '01-login.png'), Buffer.from(loginShot.data, 'base64'));
    console.log(`[shots] saved ${join(OUT, '01-login.png')}`);

    const pages = [
      ['/dashboard', '02-dashboard'],
      ['/storm-tracking', '03-storm-intelligence'],
      ['/leads', '04-leads'],
      ['/jobs', '05-jobs'],
      ['/calendar', '06-calendar'],
      ['/estimates', '07-estimates'],
      ['/reports', '08-reports'],
      ['/settings/ai', '09-ai-gateway'],
    ].filter(([, name]) => !ONLY || name.includes(ONLY));
    for (const [path, name] of pages) {
      try {
        await setAuthAndNavigate(path, name);
      } catch (err) {
        console.error(`[shots] ${name} failed: ${err.message}`);
      }
    }

    // Sprint 10: capture the QC & Passport tab and a published public passport.
    if (!ONLY) {
      try {
        const apiGet = async (path) => {
          const res = await fetch(`${API}/api/v1${path}`, {
            headers: { Authorization: `Bearer ${auth.accessToken}` },
          });
          return res.ok ? await res.json() : {};
        };
        const jobsRes = await apiGet('/jobs?limit=20');
        const jobs = Array.isArray(jobsRes.data) ? jobsRes.data : [];
        let passportSlug = null;
        let jobId = null;
        for (const job of jobs) {
          const pr = await apiGet(`/jobs/${job.id}/passport`);
          const passport = pr && pr.passport;
          if (passport && passport.enabled && passport.publicPath) {
            passportSlug = String(passport.publicPath).split('/').filter(Boolean).pop();
            jobId = job.id;
            break;
          }
        }
        if (!jobId && jobs.length > 0) jobId = jobs[0].id;
        if (jobId) {
          await setAuthAndNavigate(`/jobs/${jobId}`, '10-job-detail');
          const clicked = await cdp.send('Runtime.evaluate', {
            expression: `(() => {
              const tabs = [...document.querySelectorAll('[role="tab"]')];
              const target = tabs.find((t) => /QC\\s*&\\s*Passport/i.test(t.textContent || ''));
              if (!target) return false;
              target.focus();
              target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
              target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
              target.click();
              return true;
            })()`,
            returnByValue: true,
          });
          await sleep(2500);
          if (clicked.result?.value) await saveShot('11-job-qc-passport');
        }
        if (passportSlug) {
          await cdp.send('Page.navigate', { url: `${BASE}/p/${passportSlug}` });
          await sleep(3500);
          await saveShot('12-public-passport');
        }
      } catch (err) {
        console.error(`[shots] QC/passport captures failed: ${err.message}`);
      }
    }
    if (EVAL) {
      // Evaluate in the last-loaded page context (handy for diagnosing API calls).
      const result = await cdp.send('Runtime.evaluate', {
        expression: EVAL,
        awaitPromise: true,
        returnByValue: true,
      });
      console.log('[eval]', JSON.stringify(result.result?.value ?? result.result).slice(0, 2000));
    }
    ws.close();
    if (DEBUG) {
      console.log('[debug] page runtime events:');
      for (const event of cdp.events.slice(-20)) {
        if (event.method === 'Runtime.exceptionThrown') {
          const details = event.params?.exceptionDetails || {};
          const description = details.exception?.description || details.text || '';
          console.log('  exception:', String(description).slice(0, 900));
        } else {
          const text = JSON.stringify(event.params || {}).slice(0, 300);
          console.log('  ', event.method, text);
        }
      }
    }
    console.log(`[shots] done -> ${OUT}`);
  } finally {
    cleanup();
  }
}

main().catch((err) => {
  console.error('[shots] FAILED:', err.message);
  process.exit(1);
});




