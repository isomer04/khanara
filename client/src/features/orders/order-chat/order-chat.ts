import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
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

@Component({
  selector: 'app-order-chat',
  imports: [RouterLink, FormsModule, DatePipe],
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

  get currentUserId() {
    return this.accountService.currentUser()?.id ?? '';
  }

  ngOnInit() {
    this.orderId = Number(this.route.snapshot.paramMap.get('id'));

    // Load message history via REST
    this.orderService.getMessages(this.orderId).subscribe({
      next: (msgs) => this.messages.set(msgs),
      error: () => this.toast.error('Could not load messages'),
    });

    // Connect to hub for real-time updates (presence, status, incoming messages)
    this.hub.connect();

    this.subs.push(
      this.hub.messageReceived$.subscribe((data) => {
        if (data.orderId === this.orderId) {
          this.messages.update((m) => [...m, data.message]);
        }
      }),
      this.hub.presenceChanged$.subscribe((p) => {
        if (p.orderId === this.orderId) this.presence.set(p);
      }),
      this.hub.statusChanged$.subscribe((data) => {
        if (data.orderId === this.orderId) {
          const closed =
            data.newStatus === OrderStatus[OrderStatus.Delivered] ||
            data.newStatus === OrderStatus[OrderStatus.Cancelled];
          this.isClosed.set(closed);
        }
      })
    );

    this.hub.joinOrder(this.orderId);
  }

  ngOnDestroy() {
    this.hub.leaveOrder(this.orderId);
    this.subs.forEach((s) => s.unsubscribe());
  }

  send() {
    const content = this.newMessage().trim();
    if (!content) return;

    this.sending.set(true);
    // POST to REST endpoint — the server persists the message and broadcasts it
    // back to all hub clients in the order group via OrderMessageReceived.
    // We do NOT push the message locally here to avoid duplicates.
    this.orderService.sendMessage(this.orderId, content).subscribe({
      next: () => {
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
