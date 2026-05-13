import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { OrderService } from '../../../core/services/order-service';
import { AccountService } from '../../../core/services/account-service';
import { Order, OrderStatus, OrderStatusLabels } from '../../../types/order';

@Component({
  selector: 'app-order-list',
  imports: [RouterLink, CurrencyPipe, DatePipe],
  templateUrl: './order-list.html',
})
export class OrderList implements OnInit {
  private orderService = inject(OrderService);
  protected accountService = inject(AccountService);

  protected orders = signal<Order[]>([]);
  protected loading = signal(false);
  protected OrderStatusLabels = OrderStatusLabels;
  protected OrderStatus = OrderStatus;

  get isCook() {
    return this.accountService.currentUser()?.roles.includes('Cook') ?? false;
  }

  ngOnInit() {
    this.loadOrders();
  }

  loadOrders() {
    this.loading.set(true);
    const req = this.isCook
      ? this.orderService.getCookOrders()
      : this.orderService.getEaterOrders();

    req.subscribe({
      next: result => this.orders.set(result.items),
      complete: () => this.loading.set(false),
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
