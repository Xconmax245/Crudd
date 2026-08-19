#!/usr/bin/env node
/**
 * Cross-platform "free the dev ports" helper (readiness: Local Dev fix).
 *
 * The audit called out a stale process squatting on :3001, which forces web to
 * fall back to :3003 and breaks CORS. This runs as the root `predev` hook so
 * `pnpm dev` always starts from a clean slate.
 *
 * Frees the three app ports: 3000 (web), 3001 (api), 3002 (admin). It is a
 * best-effort, non-fatal step — if nothing is listening, it exits quietly.
 * Works on Windows (netstat + taskkill) and macOS/Linux (lsof).
 */
import { execSync } from 'node:child_process';

const PORTS = [3000, 3001, 3002];
const isWindows = process.platform === 'win32';

/** Return the set of PIDs listening on `port` (empty if none / on error). */
function pidsForPort(port) {
  try {
    if (isWindows) {
      // netstat rows: Proto  Local  Foreign  State  PID
      const out = execSync(`netstat -ano -p tcp`, { encoding: 'utf8' });
      const pids = new Set();
      for (const line of out.split(/\r?\n/)) {
        if (!line.includes('LISTENING')) continue;
        const cols = line.trim().split(/\s+/);
        const local = cols[1] ?? '';
        const pid = cols[cols.length - 1];
        if (local.endsWith(`:${port}`) && /^\d+$/.test(pid) && pid !== '0') {
          pids.add(pid);
        }
      }
      return [...pids];
    }
    // macOS / Linux
    const out = execSync(`lsof -ti tcp:${port}`, { encoding: 'utf8' });
    return out.split(/\r?\n/).filter(Boolean);
  } catch {
    // No listener (grep/lsof exit non-zero) or tool missing — nothing to do.
    return [];
  }
}

function kill(pid) {
  try {
    if (isWindows) {
      execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
    } else {
      execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
    }
    return true;
  } catch {
    return false;
  }
}

let freed = 0;
for (const port of PORTS) {
  for (const pid of pidsForPort(port)) {
    if (kill(pid)) {
      freed++;
      console.log(`[free-ports] freed :${port} (pid ${pid})`);
    }
  }
}

if (freed === 0) {
  console.log('[free-ports] ports 3000/3001/3002 already clear');
}
