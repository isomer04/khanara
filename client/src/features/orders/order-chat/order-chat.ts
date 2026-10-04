import { Component, effect, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { Subscription } from 'rxjs';
import { OrderHubService } from '../../../core/services/order-hub-service';
import { OrderService } from '../../../core/services/order-service';
import { AccountService } from '../../../core/services/account-service';
import { ToastService } from '../../../core/services/toast-service';
import { OrderMessage, OrderPresence } from '../../../types/message';
import { OrderStatus } from '../../../types/order';
import { OrderConnectionStatus } from '../../../shared/order-connection-status/order-connection-status';

@Component({
  selector: 'app-order-chat',
  imports: [RouterLink, FormsModule, DatePipe, OrderConnectionStatus],
  templateUrl: './order-chat.html',
})
export class OrderChat implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private hub = inject(OrderHubService);
  private orderService = inject(OrderService);
  private accountService = inject(AccountService);
  private toast = inject(ToastService);

  protected orderId = 0;
  protected messages = signal<OrderMessage[]>([]);
  protected presence = signal<OrderPresence | null>(null);
  protected newMessage = signal('');
  protected sending = signal(false);
  protected isClosed = signal(false);

  private subs: Subscription[] = [];
  private historyLoad?: Subscription;
  private orderLoad?: Subscription;
  private statusVersion = 0;

  constructor() {
    effect(() => {
      if (this.hub.connectionState() !== 'connected') this.presence.set(null);
    });
  }

  get currentUserId() {
    return this.accountService.currentUser()?.id ?? '';
  }

  ngOnInit() {
    this.orderId = Number(this.route.snapshot.paramMap.get('id'));

    this.loadCurrentData();

    // Connect to hub for real-time updates (presence, status, incoming messages)
    this.hub.connect();

    this.subs.push(
      this.hub.messageReceived$.subscribe((data) => {
        if (data.orderId === this.orderId) this.addMessage(data.message);
      }),
      this.hub.presenceChanged$.subscribe((p) => {
        if (p.orderId === this.orderId) this.presence.set(p);
      }),
      this.hub.statusChanged$.subscribe((data) => {
        if (data.orderId === this.orderId) {
          this.statusVersion++;
          const closed =
            data.newStatus === OrderStatus[OrderStatus.Delivered] ||
            data.newStatus === OrderStatus[OrderStatus.Cancelled];
          this.isClosed.set(closed);
        }
      })
    );

    this.subs.push(this.hub.connectionRestored$.subscribe(() => this.loadCurrentData()));

    this.hub.joinOrder(this.orderId);
  }

  private loadCurrentData() {
    this.historyLoad?.unsubscribe();
    this.orderLoad?.unsubscribe();
    this.historyLoad = this.orderService.getMessages(this.orderId).subscribe({
      next: msgs => this.messages.update(current => {
        const merged = new Map([...msgs, ...current].map(message => [message.id, message]));
        return [...merged.values()].sort((a, b) => a.sentAt.localeCompare(b.sentAt) || a.id - b.id);
      }),
      error: () => this.toast.error('Could not load messages'),
    });
    const version = this.statusVersion;
    this.orderLoad = this.orderService.getOrder(this.orderId).subscribe({
      next: order => {
        if (version === this.statusVersion) {
          this.isClosed.set(order.status === OrderStatus.Delivered || order.status === OrderStatus.Cancelled);
        }
      },
      error: () => this.toast.error('Could not load order'),
    });
  }

  ngOnDestroy() {
    // Also close the socket: an open WebSocket keeps the Cloud Run instance
    // active (and billed) for as long as the tab stays open. Closing can cancel
    // the pending leave call; OrderHub.OnDisconnectedAsync clears presence anyway.
    this.hub.leaveOrder(this.orderId)?.catch(() => {});
    this.hub.disconnect();
    this.subs.forEach((s) => s.unsubscribe());
    this.historyLoad?.unsubscribe();
    this.orderLoad?.unsubscribe();
  }

  private addMessage(message: OrderMessage) {
    this.messages.update((m) => (m.some((x) => x.id === message.id) ? m : [...m, message]));
  }

  send() {
    const content = this.newMessage().trim();
    if (!content) return;

    this.sending.set(true);
    // POST to REST endpoint — the server persists the message and broadcasts it
    // to the order group via OrderMessageReceived. Add it from the response too,
    // so the sender sees it even when the hub isn't connected; addMessage skips
    // whichever copy arrives second.
    this.orderService.sendMessage(this.orderId, content).subscribe({
      next: (message) => {
        this.addMessage(message);
        this.newMessage.set('');
        this.sending.set(false);
      },
      error: () => {
        this.toast.error('Failed to send message');
        this.sending.set(false);
      },
    });
  }
}
