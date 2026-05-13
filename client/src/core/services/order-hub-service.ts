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

  readonly statusChanged$ = new Subject<OrderStatusChanged>();
  readonly messageReceived$ = new Subject<{ orderId: number; message: OrderMessage }>();
  readonly presenceChanged$ = new Subject<OrderPresence>();

  connect() {
    if (this.connection?.state === HubConnectionState.Connected) return;

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

    this.connection.start().catch((err) => console.error('OrderHub error:', err));
  }

  disconnect() {
    if (this.connection?.state === HubConnectionState.Connected) {
      this.connection.stop().catch((err) => console.error(err));
    }
  }

  joinOrder(orderId: number) {
    return this.connection?.invoke('JoinOrder', orderId);
  }

  leaveOrder(orderId: number) {
    return this.connection?.invoke('LeaveOrder', orderId);
  }

  // sendMessage is intentionally absent — use OrderService.sendMessage() (REST) instead.
  // The REST endpoint persists the message and broadcasts it via SignalR.
  // This hub is receive-only for messages.
}
