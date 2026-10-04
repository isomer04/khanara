import { TestBed } from '@angular/core/testing';
import { HubConnectionState } from '@microsoft/signalr';
import { vi } from 'vitest';

import { OrderHubService } from './order-hub-service';
import { AccountService } from './account-service';

const { build } = vi.hoisted(() => ({ build: vi.fn() }));

vi.mock('@microsoft/signalr', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@microsoft/signalr')>()),
  HubConnectionBuilder: class {
    withUrl() {
      return this;
    }
    withAutomaticReconnect() {
      return this;
    }
    configureLogging() {
      return this;
    }
    build() {
      return build();
    }
  },
}));

// A connection whose start() stays pending until the test calls finishStart().
function fakeConnection() {
  let finishStart!: () => void;
  let reconnected!: () => void;
  const connection = {
    state: HubConnectionState.Disconnected,
    on: vi.fn(),
    onreconnecting: vi.fn(),
    onclose: vi.fn(),
    onreconnected: vi.fn((cb: () => void) => (reconnected = cb)),
    start: vi.fn(() => {
      connection.state = HubConnectionState.Connecting;
      return new Promise<void>((resolve) => {
        finishStart = () => {
          connection.state = HubConnectionState.Connected;
          resolve();
        };
      });
    }),
    stop: vi.fn(() => {
      connection.state = HubConnectionState.Disconnected;
      return Promise.resolve();
    }),
    invoke: vi.fn(() => {
      if (connection.state !== HubConnectionState.Connected) {
        return Promise.reject(new Error('not connected'));
      }
      return Promise.resolve();
    }),
  };
  return { connection, finishStart: () => finishStart(), reconnect: () => reconnected() };
}

describe('OrderHubService', () => {
  let service: OrderHubService;
  let currentUser: { token: string } | null;

  beforeEach(() => {
    build.mockReset();
    currentUser = { token: 'token' };
    TestBed.configureTestingModule({
      providers: [{ provide: AccountService, useValue: { currentUser: () => currentUser } }],
    });
    service = TestBed.inject(OrderHubService);
  });

  afterEach(() => {
    service.disconnect();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should wait for the connection to start before joining an order', async () => {
    const { connection, finishStart } = fakeConnection();
    build.mockReturnValue(connection);

    service.connect();
    const joined = service.joinOrder(5);
    await Promise.resolve();
    expect(connection.invoke).not.toHaveBeenCalled();

    finishStart();
    await joined;
    expect(connection.invoke).toHaveBeenCalledWith('JoinOrder', 5);
  });

  it('should join on a fresh connection after the previous page disconnected', async () => {
    const first = fakeConnection();
    const second = fakeConnection();
    build.mockReturnValueOnce(first.connection).mockReturnValueOnce(second.connection);

    service.connect();
    first.finishStart();
    await service.joinOrder(1);
    service.disconnect();

    service.connect();
    const joined = service.joinOrder(2);
    await Promise.resolve();
    await Promise.resolve();
    second.finishStart();
    await joined;

    expect(second.connection.invoke).toHaveBeenCalledWith('JoinOrder', 2);
  });

  it('should reuse a connection that is still connecting', () => {
    const { connection } = fakeConnection();
    build.mockReturnValue(connection);

    service.connect();
    service.connect();

    expect(build).toHaveBeenCalledTimes(1);
  });

  it('should stop a connection that is still connecting on disconnect', () => {
    const { connection } = fakeConnection();
    build.mockReturnValue(connection);

    service.connect();
    service.disconnect();

    expect(connection.stop).toHaveBeenCalled();
  });

  it('should rejoin joined orders after an automatic reconnect', async () => {
    const { connection, finishStart, reconnect } = fakeConnection();
    build.mockReturnValue(connection);

    service.connect();
    finishStart();
    await service.joinOrder(3);
    await service.joinOrder(4);
    await service.leaveOrder(4);
    connection.invoke.mockClear();

    reconnect();

    expect(connection.invoke).toHaveBeenCalledTimes(1);
    expect(connection.invoke).toHaveBeenCalledWith('JoinOrder', 3);
  });

  it('should not connect or invoke when no user is logged in', async () => {
    currentUser = null;

    service.connect();
    await service.joinOrder(1);

    expect(build).not.toHaveBeenCalled();
  });

  it('bounds initial start retries and exposes manual retry', async () => {
    vi.useFakeTimers();
    const first = fakeConnection();
    first.connection.start.mockRejectedValue(new Error('unavailable'));
    build.mockReturnValue(first.connection);
    service.connect();
    await vi.advanceTimersByTimeAsync(4000);
    expect(first.connection.start).toHaveBeenCalledTimes(3);
    expect(service.connectionState()).toBe('failed');
    const second = fakeConnection();
    build.mockReturnValue(second.connection);
    service.retry();
    await Promise.resolve();
    second.finishStart();
    await Promise.resolve();
    expect(service.connectionState()).toBe('connected');
  });

  it('cancels retry timers when navigating away', async () => {
    vi.useFakeTimers();
    const fake = fakeConnection();
    fake.connection.start.mockRejectedValue(new Error('unavailable'));
    build.mockReturnValue(fake.connection);
    service.connect();
    await Promise.resolve();
    service.disconnect();
    await vi.advanceTimersByTimeAsync(10000);
    expect(fake.connection.start).toHaveBeenCalledTimes(1);
    expect(service.connectionState()).toBe('disconnected');
  });

  it('pauses after 30 seconds hidden, then rejoins and reports restoration', async () => {
    vi.useFakeTimers();
    let hidden = false;
    vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
    const first = fakeConnection();
    const second = fakeConnection();
    build.mockReturnValueOnce(first.connection).mockReturnValueOnce(second.connection);
    service.connect();
    first.finishStart();
    await service.joinOrder(7);
    const restored = vi.fn();
    service.connectionRestored$.subscribe(restored);
    hidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(29999);
    expect(first.connection.stop).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(service.connectionState()).toBe('paused');
    hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
    await Promise.resolve();
    second.finishStart();
    await vi.advanceTimersByTimeAsync(0);
    expect(second.connection.invoke).toHaveBeenCalledWith('JoinOrder', 7);
    expect(restored).toHaveBeenCalledTimes(1);
    expect(service.connectionState()).toBe('connected');
  });

  it('cancels the hidden timer when visibility returns early', async () => {
    vi.useFakeTimers();
    let hidden = false;
    vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
    const fake = fakeConnection();
    build.mockReturnValue(fake.connection);
    service.connect();
    hidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(20000);
    hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(30000);
    expect(fake.connection.stop).not.toHaveBeenCalled();
  });

  it('ignores callbacks and pending joins from a discarded connection', async () => {
    const fake = fakeConnection();
    build.mockReturnValue(fake.connection);
    service.connect();
    const joined = service.joinOrder(7);
    service.disconnect();
    fake.finishStart();
    fake.reconnect();
    await joined;
    expect(fake.connection.invoke).not.toHaveBeenCalled();
    expect(service.connectionState()).toBe('disconnected');
  });

  it('waits for an older socket to stop even if an intermediate start is cancelled', async () => {
    vi.useFakeTimers();
    const first = fakeConnection();
    const second = fakeConnection();
    const third = fakeConnection();
    let finishStop!: () => void;
    first.connection.stop.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishStop = resolve;
        }),
    );
    build
      .mockReturnValueOnce(first.connection)
      .mockReturnValueOnce(second.connection)
      .mockReturnValueOnce(third.connection);
    service.connect();
    first.finishStart();
    await service.joinOrder(7);
    service.retry();
    service.retry();
    await vi.advanceTimersByTimeAsync(0);
    expect(second.connection.start).not.toHaveBeenCalled();
    expect(third.connection.start).not.toHaveBeenCalled();
    finishStop();
    await vi.advanceTimersByTimeAsync(0);
    expect(second.connection.start).not.toHaveBeenCalled();
    expect(third.connection.start).toHaveBeenCalledTimes(1);
    third.finishStart();
    await vi.advanceTimersByTimeAsync(0);
    expect(service.connectionState()).toBe('connected');
  });
});
