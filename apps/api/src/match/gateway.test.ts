import { describe, it, expect, vi, beforeEach } from 'vitest';
import { attachMatchGateway } from './gateway';
import { MatchEngine, MatchEngineError } from './engine';
import { Server } from 'socket.io';
import { redis } from './redis';

vi.mock('../logger', () => ({
  logger: { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() },
}));
vi.mock('../observability', () => ({
  Sentry: {},
  captureException: vi.fn(),
}));


// Mock dependencies
vi.mock('./engine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./engine')>();
  return {
    ...actual,
    MatchEngine: class {
      ensureLobby = vi.fn();
      join = vi.fn();
      rejoinSnapshot = vi.fn();
      broadcastLobby = vi.fn();
      startMatch = vi.fn();
      submitAnswer = vi.fn();
      markDisconnected = vi.fn();
      stop = vi.fn();
    },
  };
});
vi.mock('./redis', () => ({
  redis: {
    duplicate: vi.fn().mockReturnValue({
      on: vi.fn(),
      disconnect: vi.fn(),
    }),
  },
}));

vi.mock('socket.io', () => {
  return {
    Server: class {
      adapter = vi.fn();
      on = vi.fn();
      close = vi.fn((cb) => cb && cb());
    }
  };
});

vi.mock('@socket.io/redis-adapter', () => ({
  createAdapter: vi.fn(),
}));

describe('MatchGateway', () => {
  let mockIo: any;
  let mockSocket: any;
  let engineMock: any;
  let gateway: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockSocket = {
      data: {},
      join: vi.fn(),
      emit: vi.fn(),
      on: vi.fn(),
    };

    gateway = attachMatchGateway({} as any, []);
    mockIo = gateway.io;
    engineMock = gateway.engine;

    // Extract the connection handler and call it with our mock socket
    const connectionHandler = mockIo.on.mock.calls.find((c: any) => c[0] === 'connection')?.[1];
    if (connectionHandler) {
      connectionHandler(mockSocket);
    }
  });

  const triggerSocketEvent = async (event: string, payload?: any) => {
    const handler = mockSocket.on.mock.calls.find((c: any) => c[0] === event)?.[1];
    if (handler) {
      await handler(payload);
    }
  };

  it('handles valid JOIN event', async () => {
    engineMock.ensureLobby.mockResolvedValue({ challengeId: 'c1' });
    engineMock.join.mockResolvedValue();
    engineMock.rejoinSnapshot.mockResolvedValue(null);

    await triggerSocketEvent('lobby:join', { slug: 'slug', sessionId: 's1', username: 'User', playerId: 'p1' });

    expect(engineMock.ensureLobby).toHaveBeenCalledWith('slug');
    // The persistent soft-account playerId is forwarded to the engine so the
    // match's points can accrue to the global leaderboard.
    expect(engineMock.join).toHaveBeenCalledWith('c1', 's1', 'User', 'p1');

    expect(mockSocket.join).toHaveBeenCalledWith('match:c1');
    expect(engineMock.broadcastLobby).toHaveBeenCalledWith('c1');
  });

  it('rejects JOIN with invalid payload', async () => {
    await triggerSocketEvent('lobby:join', { slug: '' });

    expect(mockSocket.emit).toHaveBeenCalledWith('match:error', expect.objectContaining({
      code: 'BAD_REQUEST',
    }));
  });

  it('handles START event', async () => {
    Object.assign(mockSocket.data, { challengeId: 'c1', sessionId: 's1' });
    
    await triggerSocketEvent('host:start');

    expect(engineMock.startMatch).toHaveBeenCalledWith('c1', 's1');
  });

  it('rejects START if not joined', async () => {
    await triggerSocketEvent('host:start');
    
    expect(engineMock.startMatch).not.toHaveBeenCalled();
    expect(mockSocket.emit).toHaveBeenCalledWith('match:error', expect.objectContaining({
      code: 'BAD_REQUEST',
    }));
  });

  it('handles SUBMIT event', async () => {
    Object.assign(mockSocket.data, { challengeId: 'c1', sessionId: 's1' });
    engineMock.submitAnswer.mockResolvedValue({ accepted: true, selectedIndex: 1 });

    await triggerSocketEvent('answer:submit', { position: 0, selectedIndex: 1 });

    expect(engineMock.submitAnswer).toHaveBeenCalledWith('c1', 's1', 0, 1);
    expect(mockSocket.emit).toHaveBeenCalledWith('answer:ack', expect.objectContaining({
      accepted: true,
      selectedIndex: 1
    }));
  });

  it('catches Engine errors during SUBMIT and emits ack with reason', async () => {
    Object.assign(mockSocket.data, { challengeId: 'c1', sessionId: 's1' });
    engineMock.submitAnswer.mockRejectedValue(new MatchEngineError('Too late', 'CLOSED'));

    await triggerSocketEvent('answer:submit', { position: 0, selectedIndex: 1 });

    expect(mockSocket.emit).toHaveBeenCalledWith('answer:ack', expect.objectContaining({
      accepted: false,
      reason: 'Too late'
    }));
  });

  it('rate limits excessive events', async () => {
    Object.assign(mockSocket.data, { challengeId: 'c1', sessionId: 's1' });
    
    // Fire 6 events rapidly
    for (let i = 0; i < 6; i++) {
      await triggerSocketEvent('answer:submit', { position: 0, selectedIndex: 1 });
    }

    // First 5 pass to engine (or fail validation), 6th is rate limited
    expect(mockSocket.emit).toHaveBeenCalledWith('answer:ack', expect.objectContaining({
      accepted: false,
      reason: 'Slow down'
    }));
  });

  it('handles disconnect', async () => {
    Object.assign(mockSocket.data, { challengeId: 'c1', sessionId: 's1' });
    await triggerSocketEvent('disconnect');
    expect(engineMock.markDisconnected).toHaveBeenCalledWith('c1', 's1');
  });
});
