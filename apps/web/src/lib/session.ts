// Guest identity helpers. A stable per-browser session id identifies a player
// across the lobby/match; the host is the session that created the challenge.

const SESSION_KEY = 'crudd_session_id';
const USERNAME_KEY = 'crudd_username';
// The persistent (soft-account) player id lives in localStorage, NOT
// sessionStorage, so it survives tab/window close and powers the global
// leaderboard across all sessions on this device.
const PLAYER_ID_KEY = 'crudd_player_id';

export function getSessionId(): string {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function getUsername(): string | null {
  return sessionStorage.getItem(USERNAME_KEY);
}

export function setUsername(name: string): void {
  sessionStorage.setItem(USERNAME_KEY, name);
}

/**
 * The player's permanent identity for this device. Generated lazily the first
 * time it's needed and never overwritten thereafter. This is the invisible
 * "soft account" that ties a device's scores together on the global leaderboard
 * — there is deliberately no registration, password, or UI around it.
 */
export function getPlayerId(): string {
  let id = localStorage.getItem(PLAYER_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(PLAYER_ID_KEY, id);
  }
  return id;
}

/** Read the persistent player id without creating one (null if never set). */
export function peekPlayerId(): string | null {
  return localStorage.getItem(PLAYER_ID_KEY);
}


