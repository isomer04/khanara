import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize, Subscription } from 'rxjs';
import { OrderService } from '../../../core/services/order-service';
import { AccountService } from '../../../core/services/account-service';
import { ToastService } from '../../../core/services/toast-service';
import { OrderHubService } from '../../../core/services/order-hub-service';
import { Order, OrderStatus, OrderStatusLabels, FulfillmentType, PaymentMethod, PaymentStatus } from '../../../types/order';
import { ReviewCard } from '../../reviews/review-card/review-card';
import { OrderConnectionStatus } from '../../../shared/order-connection-status/order-connection-status';

@Component({
  selector: 'app-order-detail',
  imports: [RouterLink, CurrencyPipe, DatePipe, FormsModule, ReviewCard, OrderConnectionStatus],
  templateUrl: './order-detail.html',
})
export class OrderDetail implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private orderService = inject(OrderService);
  private accountService = inject(AccountService);
  private toast = inject(ToastService);
  private hub = inject(OrderHubService);

  protected order = signal<Order | null>(null);
  protected PaymentMethod = PaymentMethod;
  protected PaymentStatus = PaymentStatus;
  protected loading = signal(false);
  protected actionLoading = signal(false);
  protected cancelReason = signal('');
  protected showCancelForm = signal(false);

  protected OrderStatus = OrderStatus;
  protected OrderStatusLabels = OrderStatusLabels;
  protected FulfillmentType = FulfillmentType;

  private orderId = 0;
  private subs: Subscription[] = [];
  private statusVersion = 0;
  private latestStatus?: OrderStatus;
  private reload?: Subscription;

  get currentUserId() {
    return this.accountService.currentUser()?.id ?? '';
  }

  get isCook() {
    return this.accountService.currentUser()?.roles.includes('Cook') ?? false;
  }

  get isEater() {
    const o = this.order();
    return o?.eaterUserId === this.currentUserId;
  }

  get nextStatus(): OrderStatus | null {
    const map: Partial<Record<OrderStatus, OrderStatus>> = {
      [OrderStatus.Pending]:   OrderStatus.Accepted,
      [OrderStatus.Accepted]:  OrderStatus.Preparing,
      [OrderStatus.Preparing]: OrderStatus.Ready,
      [OrderStatus.Ready]:     OrderStatus.Delivered,
    };
    const current = this.order()?.status;
    return current !== undefined ? (map[current] ?? null) : null;
  }

  get nextStatusLabel(): string {
    const next = this.nextStatus;
    return next !== null ? OrderStatusLabels[next] : '';
  }

  get canCookCancel(): boolean {
    const s = this.order()?.status;
    return s === OrderStatus.Pending || s === OrderStatus.Accepted || s === OrderStatus.Preparing;
  }

  get canEaterCancel(): boolean {
    return this.order()?.status === OrderStatus.Pending;
  }

  ngOnInit() {
    this.orderId = Number(this.route.snapshot.paramMap.get('id'));
    this.loadOrder();

    this.hub.connect();

    this.subs.push(
      this.hub.statusChanged$.subscribe((data) => {
        if (data.orderId === this.orderId) {
          this.statusVersion++;
          this.latestStatus = OrderStatus[data.newStatus as keyof typeof OrderStatus];
          this.order.update((o) => {
            if (!o) return o;
            return {
              ...o,
              status: OrderStatus[data.newStatus as keyof typeof OrderStatus],
            };
          });
        }
      })
    );

    this.subs.push(this.hub.connectionRestored$.subscribe(() => this.loadOrder()));

    this.hub.joinOrder(this.orderId);
  }

  private loadOrder() {
    this.reload?.unsubscribe();
    const version = this.statusVersion;
    this.loading.set(true);
    this.reload = this.orderService.getOrder(this.orderId).pipe(
      finalize(() => this.loading.set(false))
    ).subscribe({
      next: order => this.order.set(version !== this.statusVersion && this.latestStatus !== undefined
        ? { ...order, status: this.latestStatus } : order),
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
    this.reload?.unsubscribe();
  }

  advanceStatus() {
    const next = this.nextStatus;
    const id = this.order()?.id;
    if (next === null || !id) return;

    this.actionLoading.set(true);
    this.orderService.updateStatus(id, { newStatus: next }).pipe(
      finalize(() => this.actionLoading.set(false))
    ).subscribe({
      next: updated => {
        this.order.set(updated);
        this.toast.success(`Status updated to ${OrderStatusLabels[next]}`);
      },
      error: () => this.toast.error('Failed to update status'),
    });
  }

  cancelOrder() {
    const reason = this.cancelReason().trim();
    const id = this.order()?.id;
    if (!reason || !id) return;

    this.actionLoading.set(true);
    this.orderService.cancelOrder(id, { reason }).pipe(
      finalize(() => this.actionLoading.set(false))
    ).subscribe({
      next: updated => {
        this.order.set(updated);
        this.showCancelForm.set(false);
        this.cancelReason.set('');
        this.toast.success('Order cancelled');
      },
      error: () => this.toast.error('Failed to cancel order'),
    });
  }

  statusBadgeClass(status: OrderStatus): string {
    const map: Record<OrderStatus, string> = {
      [OrderStatus.Pending]:   'badge-warning',
      [OrderStatus.Accepted]:  'badge-info',
      [OrderStatus.Preparing]: 'badge-info',
      [OrderStatus.Ready]:     'badge-success',
      [OrderStatus.Delivered]: 'badge-neutral',
      [OrderStatus.Cancelled]: 'badge-error',
    };
    return map[status] ?? 'badge-ghost';
  }
}
