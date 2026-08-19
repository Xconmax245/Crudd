import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import {
  MATCH_EVENTS,
  type LobbyStatePayload,
  type QuestionStartPayload,
  type QuestionEndPayload,
  type MatchEndPayload,
  type AnswerAckPayload,
  type MatchErrorPayload,
  type CountdownPayload,
  type LobbyCancelledPayload,
} from '@crudd/shared';
import { createMatchSocket } from '../lib/socket';
import { getSessionId, getUsername } from '../lib/session';

export type ConnectionState = 'connecting' | 'connected' | 'disconnected';

export interface MatchEngineState {
  connection: ConnectionState;
  lobby: LobbyStatePayload | null;
  /** Non-null while the 3-2-1 countdown before Q1 is running (STARTING phase). */
  countdown: CountdownPayload | null;
  question: QuestionStartPayload | null;
  /** The option index this client submitted for the current question. */
  selectedIndex: number | null;
  answerRejected: string | null;
  reveal: QuestionEndPayload | null;
  ended: MatchEndPayload | null;
  /** Reason string when the lobby is cancelled before it ever starts. */
  cancelled: string | null;
  error: string | null;
}


export interface MatchEngineApi extends MatchEngineState {
  sessionId: string;
  isHost: boolean;
  start: () => void;
  submit: (selectedIndex: number) => void;
  next: () => void;
}

/**
 * Owns one Socket.IO connection for the lifetime of a match and exposes the
 * server-broadcast state plus host/player actions. The server is authoritative;
 * this hook only mirrors what it is told and sends intents.
 */
export function useMatchEngine(slug: string): MatchEngineApi {
  const socketRef = useRef<Socket | null>(null);
  const sessionId = getSessionId();

  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [lobby, setLobby] = useState<LobbyStatePayload | null>(null);
  const [countdown, setCountdown] = useState<CountdownPayload | null>(null);
  const [question, setQuestion] = useState<QuestionStartPayload | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [answerRejected, setAnswerRejected] = useState<string | null>(null);
  const [reveal, setReveal] = useState<QuestionEndPayload | null>(null);
  const [ended, setEnded] = useState<MatchEndPayload | null>(null);
  const [cancelled, setCancelled] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);


  useEffect(() => {
    const socket = createMatchSocket();
    socketRef.current = socket;

    const join = () => {
      setConnection('connected');
      socket.emit(MATCH_EVENTS.JOIN, {
        slug,
        sessionId,
        username: getUsername(),
      });
    };

    socket.on('connect', join);
    socket.on('disconnect', () => setConnection('disconnected'));
    socket.io.on('reconnect', join);

    socket.on(MATCH_EVENTS.LOBBY_STATE, (payload: LobbyStatePayload) => {
      setLobby(payload);
    });

    socket.on(MATCH_EVENTS.COUNTDOWN, (payload: CountdownPayload) => {
      setCountdown(payload);
      setReveal(null);
      setEnded(null);
    });

    socket.on(MATCH_EVENTS.QUESTION_START, (payload: QuestionStartPayload) => {
      setQuestion(payload);
      setCountdown(null);
      setReveal(null);
      setSelectedIndex(null);
      setAnswerRejected(null);
    });


    socket.on(MATCH_EVENTS.ANSWER_ACK, (payload: AnswerAckPayload) => {
      if (payload.accepted) {
        setSelectedIndex(payload.selectedIndex);
        setAnswerRejected(null);
      } else {
        setSelectedIndex(null);
        setAnswerRejected(payload.reason ?? 'Answer rejected');
      }
    });

    socket.on(MATCH_EVENTS.QUESTION_END, (payload: QuestionEndPayload) => {
      setReveal(payload);
    });

    socket.on(MATCH_EVENTS.MATCH_END, (payload: MatchEndPayload) => {
      setEnded(payload);
    });

    socket.on(MATCH_EVENTS.LOBBY_CANCELLED, (payload: LobbyCancelledPayload) => {
      setCancelled(payload.reason);
    });

    socket.on(MATCH_EVENTS.ERROR, (payload: MatchErrorPayload) => {
      setError(payload.message);
    });


    socket.connect();

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [slug, sessionId]);

  const start = useCallback(() => {
    socketRef.current?.emit(MATCH_EVENTS.START);
  }, []);

  const submit = useCallback(
    (index: number) => {
      if (!question) return;
      // Optimistic selection; server confirms via ANSWER_ACK.
      setSelectedIndex(index);
      socketRef.current?.emit(MATCH_EVENTS.SUBMIT, {
        position: question.position,
        selectedIndex: index,
      });
    },
    [question],
  );

  const next = useCallback(() => {
    socketRef.current?.emit(MATCH_EVENTS.NEXT);
  }, []);

  const isHost = lobby?.hostSessionId === sessionId;

  return {
    connection,
    lobby,
    countdown,
    question,
    selectedIndex,
    answerRejected,
    reveal,
    ended,
    cancelled,
    error,
    sessionId,
    isHost,
    start,
    submit,
    next,
  };

}
