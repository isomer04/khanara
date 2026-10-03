import { inject, Injectable } from '@angular/core';
import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from '@microsoft/signalr';
import { Subject } from 'rxjs';
import { environment } from '../../environments/environment';
import { AccountService } from './account-service';
import { OrderMessage, OrderPresence, OrderStatusChanged } from '../../types/message';

@Injectable({ providedIn: 'root' })
export class OrderHubService {
  private hubUrl = environment.hubUrl;
  private accountService = inject(AccountService);

  private connection?: HubConnection;
  // Settles when `connection` has started. Hub calls wait on it: invoking on a
  // connection that is still connecting is rejected by the SignalR client.
  private started?: Promise<void>;
  // Orders this connection has joined; groups don't survive a reconnect.
  private joinedOrders = new Set<number>();

  readonly statusChanged$ = new Subject<OrderStatusChanged>();
  readonly messageReceived$ = new Subject<{ orderId: number; message: OrderMessage }>();
  readonly presenceChanged$ = new Subject<OrderPresence>();

  connect() {
    if (this.connection && this.connection.state !== HubConnectionState.Disconnected) return;

    if (!this.accountService.currentUser()) return;

    this.connection = new HubConnectionBuilder()
      .withUrl(this.hubUrl + 'order', {
        // Read on every (re)connect so a reconnect uses the refreshed token
        accessTokenFactory: () => this.accountService.currentUser()?.token ?? '',
      })
      .withAutomaticReconnect()
      // Information level logs the WebSocket URL, which carries the access token
      .configureLogging(environment.production ? LogLevel.Warning : LogLevel.Information)
      .build();

    this.connection.onreconnected(() => {
      for (const orderId of this.joinedOrders) {
        this.connection?.invoke('JoinOrder', orderId).catch((err) =>
          console.error('OrderHub error:', err)
        );
      }
    });

    this.connection.on('OrderStatusChanged', (data: OrderStatusChanged) =>
      this.statusChanged$.next(data)
    );

    this.connection.on(
      'OrderMessageReceived',
      (data: { orderId: number; message: OrderMessage }) =>
        this.messageReceived$.next(data)
    );

    this.connection.on('OrderPresence', (data: OrderPresence) =>
      this.presenceChanged$.next(data)
    );

    this.started = this.connection.start();
    this.started.catch((err) => console.error('OrderHub error:', err));
  }

  disconnect() {
    // Stop even while still connecting, so leaving the page before the
    // handshake finishes doesn't leave the socket open.
    this.connection?.stop().catch((err) => console.error(err));
    this.connection = undefined;
    this.started = undefined;
    this.joinedOrders.clear();
  }

  joinOrder(orderId: number) {
    this.joinedOrders.add(orderId);
    return this.invokeWhenStarted('JoinOrder', orderId).catch((err) =>
      console.error('OrderHub error:', err)
    );
  }

  leaveOrder(orderId: number) {
    this.joinedOrders.delete(orderId);
    return this.invokeWhenStarted('LeaveOrder', orderId);
  }

  private async invokeWhenStarted(methodName: string, ...args: unknown[]) {
    const connection = this.connection;
    if (!connection) return;
    await this.started;
    await connection.invoke(methodName, ...args);
  }

  // sendMessage is intentionally absent — use OrderService.sendMessage() (REST) instead.
  // The REST endpoint persists the message and broadcasts it via SignalR.
  // This hub is receive-only for messages.
}
