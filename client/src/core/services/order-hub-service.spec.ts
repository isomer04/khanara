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
});
