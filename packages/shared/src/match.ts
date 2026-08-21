// ===========================================================================
// Phase 2 — Real-time Match Engine contract
// Shared socket event names + payload shapes used by both the API (Socket.IO
// server) and the web client. The server is authoritative for all timing and
// scoring; clients render server-broadcast state only (BUILD_DIRECTIVE §9).
// ===========================================================================

import type { ChallengeStatus, ParticipantRole } from './index';

/** Canonical socket event names. */
export const MATCH_EVENTS = {
  // client -> server
  JOIN: 'lobby:join',
  START: 'host:start',
  SUBMIT: 'answer:submit',
  NEXT: 'host:next',
  CHAT_SEND: 'chat:send',
  // server -> client
  LOBBY_STATE: 'lobby:state',
  LOBBY_CANCELLED: 'lobby:cancelled',
  ERROR: 'match:error',
  COUNTDOWN: 'match:countdown',
  QUESTION_START: 'question:start',
  ANSWER_ACK: 'answer:ack',
  QUESTION_END: 'question:end',
  MATCH_END: 'match:end',
  CHAT_RECEIVE: 'chat:receive',
} as const;

/**
 * Fine-grained runtime phase (lives in Redis while a match is live).
 * STARTING is the 3-2-1 countdown before the first question (BUILD_DIRECTIVE §9).
 */
export type MatchPhase = 'LOBBY' | 'STARTING' | 'QUESTION' | 'REVEAL' | 'ENDED';


export interface LobbyPlayer {
  sessionId: string;
  username: string | null;
  role: ParticipantRole;
  score: number;
  connected: boolean;
}

// --- client -> server -------------------------------------------------------

export interface JoinPayload {
  slug: string;
  sessionId: string;
  username: string | null;
  /**
   * Persistent cross-session player identity (soft account) from the client's
   * localStorage. Optional: old clients / direct API calls omit it and still
   * join normally — they just won't accrue toward the global leaderboard.
   */
  playerId?: string | null;
}


export interface SubmitAnswerPayload {
  position: number;
  selectedIndex: number;
}

export interface ChatSendPayload {
  message: string;
}

// --- server -> client -------------------------------------------------------

export interface ChatMessagePayload {
  sessionId: string;
  username: string | null;
  message: string;
  timestamp: number;
}

export interface LobbyStatePayload {
  status: ChallengeStatus;
  phase: MatchPhase;
  hostSessionId: string;
  players: LobbyPlayer[];
  bankTitle: string;
  questionCount: number;
  timerSeconds: number;
  maxPlayers: number;
  /** 0-based index of the current/last question; -1 while in the lobby. */
  currentPosition: number;
}

/** 3-2-1 countdown before the first question (STARTING phase). */
export interface CountdownPayload {
  /** Server-clock epoch ms when the first question will open. */
  startsAt: number;
}

/** Broadcast when a lobby is closed before it ever started (e.g. host left). */
export interface LobbyCancelledPayload {
  reason: string;
}

export interface QuestionStartPayload {
  /** 0-based position within the match. */
  position: number;
  totalQuestions: number;
  questionText: string;
  /** Shuffled option texts only — never includes the correct index. */
  options: string[];
  /** Server-clock epoch ms when the question opened. */
  startedAt: number;
  /** Server-clock epoch ms when the question closes. */
  endsAt: number;
  timerSeconds: number;
}


export interface AnswerAckPayload {
  position: number;
  accepted: boolean;
  selectedIndex: number;
  reason?: string;
}

export interface PlayerQuestionResult {
  sessionId: string;
  username: string | null;
  selectedIndex: number | null;
  isCorrect: boolean;
  pointsAwarded: number;
}

export interface LeaderboardEntry {
  sessionId: string;
  username: string | null;
  score: number;
  rank: number;
}

export interface QuestionEndPayload {
  position: number;
  /** The question text, echoed so REVEAL-phase rejoins can render standalone. */
  questionText: string;
  /** Shuffled option texts, so a rejoining client need not retain prior state. */
  options: string[];
  correctIndex: number;
  results: PlayerQuestionResult[];
  leaderboard: LeaderboardEntry[];
  isLastQuestion: boolean;
}


/** Per-player summary stats for the final results screen (§7.10 / §15). */
export interface PlayerMatchStats {
  sessionId: string;
  username: string | null;
  score: number;
  rank: number;
  correctCount: number;
  totalQuestions: number;
  /** correctCount / totalQuestions as a 0–100 percentage (rounded). */
  accuracy: number;
  /** Average response time in ms across correct answers only (0 if none). */
  avgResponseMs: number;
}

export interface MatchEndPayload {
  leaderboard: LeaderboardEntry[];
  stats: PlayerMatchStats[];
}


export interface MatchErrorPayload {
  message: string;
  code?: string;
}
