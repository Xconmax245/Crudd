// Guest identity helpers. A stable per-browser session id identifies a player
// across the lobby/match; the host is the session that created the challenge.

const SESSION_KEY = 'crudd_session_id';
const USERNAME_KEY = 'crudd_username';

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
