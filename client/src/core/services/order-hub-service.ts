import { DOCUMENT } from '@angular/common';
import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { HubConnection, HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { Subject } from 'rxjs';
import { environment } from '../../environments/environment';
import { AccountService } from './account-service';
import { OrderMessage, OrderPresence, OrderStatusChanged } from '../../types/message';

export type OrderConnectionState =
  'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'paused' | 'failed';

@Injectable({ providedIn: 'root' })
export class OrderHubService {
  private accountService = inject(AccountService);
  private document = inject(DOCUMENT);
  private connection?: HubConnection;
  private started?: Promise<void>;
  private stopping?: Promise<void>;
  private joinedOrders = new Set<number>();
  private hiddenTimer?: ReturnType<typeof setTimeout>;
  private cancelRetry?: () => void;
  private listening = false;

  readonly connectionState = signal<OrderConnectionState>('disconnected');
  readonly connectionRestored$ = new Subject<void>();
  readonly statusChanged$ = new Subject<OrderStatusChanged>();
  readonly messageReceived$ = new Subject<{ orderId: number; message: OrderMessage }>();
  readonly presenceChanged$ = new Subject<OrderPresence>();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.disconnect());
  }

  connect() {
    if (this.connection || !this.accountService.currentUser()) return;
    if (!this.listening) {
      this.document.addEventListener('visibilitychange', this.visibilityChanged);
      this.listening = true;
    }
    const restoring = this.joinedOrders.size > 0;
    const connection = new HubConnectionBuilder()
      .withUrl(environment.hubUrl + 'order', {
        accessTokenFactory: () => this.accountService.currentUser()?.token ?? '',
      })
      .withAutomaticReconnect()
      .configureLogging(environment.production ? LogLevel.Warning : LogLevel.Information)
      .build();
    this.connection = connection;
    this.connectionState.set(restoring ? 'reconnecting' : 'connecting');
    connection.onreconnecting(() => {
      if (this.connection === connection) this.connectionState.set('reconnecting');
    });
    connection.onreconnected(() => {
      if (this.connection === connection) void this.restore(connection);
    });
    connection.onclose(() => {
      if (this.connection === connection) {
        this.connection = undefined;
        this.connectionState.set('failed');
      }
    });
    connection.on('OrderStatusChanged', (data: OrderStatusChanged) => {
      if (this.connection === connection) this.statusChanged$.next(data);
    });
    connection.on('OrderMessageReceived', (data: { orderId: number; message: OrderMessage }) => {
      if (this.connection === connection) this.messageReceived$.next(data);
    });
    connection.on('OrderPresence', (data: OrderPresence) => {
      if (this.connection === connection) this.presenceChanged$.next(data);
    });
    this.started = this.start(connection, restoring);
    void this.started.catch(() => {});
    if (this.document.hidden) this.visibilityChanged();
  }

  private async start(connection: HubConnection, restoring: boolean) {
    if (this.stopping) await this.stopping;
    for (let attempt = 0; attempt < 3 && this.connection === connection; attempt++) {
      try {
        await connection.start();
        if (this.connection !== connection) return;
        if (restoring) await this.restore(connection);
        else this.connectionState.set('connected');
        return;
      } catch (error) {
        if (this.connection !== connection) return;
        if (attempt === 2) {
          this.stop();
          this.connectionState.set('failed');
          throw error;
        }
        await new Promise<void>((resolve) => {
          const timer = setTimeout(
            () => {
              this.cancelRetry = undefined;
              resolve();
            },
            attempt === 0 ? 1000 : 3000,
          );
          this.cancelRetry = () => {
            clearTimeout(timer);
            resolve();
          };
        });
      }
    }
  }

  private async restore(connection: HubConnection) {
    try {
      await Promise.all([...this.joinedOrders].map((id) => connection.invoke('JoinOrder', id)));
      if (this.connection !== connection) return;
      this.connectionState.set('connected');
      this.connectionRestored$.next();
    } catch {
      if (this.connection === connection) {
        this.stop();
        this.connectionState.set('failed');
      }
    }
  }

  retry() {
    this.stop();
    this.connect();
  }

  private visibilityChanged = () => {
    clearTimeout(this.hiddenTimer);
    if (this.document.hidden) {
      this.hiddenTimer = setTimeout(() => {
        this.stop();
        this.connectionState.set('paused');
      }, 30000);
    } else if (this.connectionState() === 'paused') {
      this.connect();
    }
  };

  private stop() {
    const connection = this.connection;
    this.connection = undefined;
    this.started = undefined;
    this.cancelRetry?.();
    this.cancelRetry = undefined;
    if (connection) {
      const stopCurrent = connection.stop().catch(() => {});
      // A newer connection can be cancelled while still waiting for the old
      // socket to stop. Keep that older stop in the chain for the next start.
      const stopping = this.stopping
        ? Promise.all([this.stopping, stopCurrent]).then(() => {})
        : stopCurrent;
      this.stopping = stopping;
      void stopping.then(() => {
        if (this.stopping === stopping) this.stopping = undefined;
      });
    }
  }

  disconnect() {
    clearTimeout(this.hiddenTimer);
    this.document.removeEventListener('visibilitychange', this.visibilityChanged);
    this.listening = false;
    this.stop();
    this.joinedOrders.clear();
    this.connectionState.set('disconnected');
  }

  joinOrder(orderId: number) {
    this.joinedOrders.add(orderId);
    return this.invokeWhenStarted('JoinOrder', orderId).catch(() => {});
  }

  leaveOrder(orderId: number) {
    this.joinedOrders.delete(orderId);
    return this.invokeWhenStarted('LeaveOrder', orderId);
  }

  private async invokeWhenStarted(methodName: string, orderId: number) {
    const connection = this.connection;
    if (!connection) return;
    await this.started;
    if (this.connection !== connection) return;
    if (methodName === 'JoinOrder' && !this.joinedOrders.has(orderId)) return;
    await connection.invoke(methodName, orderId);
  }
}
