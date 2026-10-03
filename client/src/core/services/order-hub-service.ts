import { inject, Injectable } from '@angular/core';
import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
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

  readonly statusChanged$ = new Subject<OrderStatusChanged>();
  readonly messageReceived$ = new Subject<{ orderId: number; message: OrderMessage }>();
  readonly presenceChanged$ = new Subject<OrderPresence>();

  connect() {
    if (this.connection && this.connection.state !== HubConnectionState.Disconnected) return;

    const user = this.accountService.currentUser();
    if (!user) return;

    this.connection = new HubConnectionBuilder()
      .withUrl(this.hubUrl + 'order', {
        accessTokenFactory: () => user.token,
      })
      .withAutomaticReconnect()
      .build();

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
  }

  joinOrder(orderId: number) {
    return this.invokeWhenStarted('JoinOrder', orderId).catch((err) =>
      console.error('OrderHub error:', err)
    );
  }

  leaveOrder(orderId: number) {
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
