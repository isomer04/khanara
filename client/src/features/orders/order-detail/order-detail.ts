import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { OrderService } from '../../../core/services/order-service';
import { AccountService } from '../../../core/services/account-service';
import { ToastService } from '../../../core/services/toast-service';
import { OrderHubService } from '../../../core/services/order-hub-service';
import { Order, OrderStatus, OrderStatusLabels, FulfillmentType, PaymentMethod, PaymentStatus } from '../../../types/order';
import { ReviewCard } from '../../reviews/review-card/review-card';

@Component({
  selector: 'app-order-detail',
  imports: [RouterLink, CurrencyPipe, DatePipe, FormsModule, ReviewCard],
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
    this.loading.set(true);
    this.orderService.getOrder(this.orderId).subscribe({
      next: order => this.order.set(order),
      error: () => this.toast.error('Order not found'),
      complete: () => this.loading.set(false),
    });

    this.hub.connect();

    this.subs.push(
      this.hub.statusChanged$.subscribe((data) => {
        if (data.orderId === this.orderId) {
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

    this.hub.joinOrder(this.orderId);
  }

  ngOnDestroy() {
    this.hub.leaveOrder(this.orderId);
    this.subs.forEach((s) => s.unsubscribe());
  }

  advanceStatus() {
    const next = this.nextStatus;
    const id = this.order()?.id;
    if (next === null || !id) return;

    this.actionLoading.set(true);
    this.orderService.updateStatus(id, { newStatus: next }).subscribe({
      next: updated => {
        this.order.set(updated);
        this.toast.success(`Status updated to ${OrderStatusLabels[next]}`);
      },
      error: () => this.toast.error('Failed to update status'),
      complete: () => this.actionLoading.set(false),
    });
  }

  cancelOrder() {
    const reason = this.cancelReason().trim();
    const id = this.order()?.id;
    if (!reason || !id) return;

    this.actionLoading.set(true);
    this.orderService.cancelOrder(id, { reason }).subscribe({
      next: updated => {
        this.order.set(updated);
        this.showCancelForm.set(false);
        this.cancelReason.set('');
        this.toast.success('Order cancelled');
      },
      error: () => this.toast.error('Failed to cancel order'),
      complete: () => this.actionLoading.set(false),
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
