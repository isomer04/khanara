import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { Order, CreateOrderDto, UpdateOrderStatusDto, CancelOrderDto, OrderStatus } from '../../types/order';
import { OrderMessage } from '../../types/message';
import { PaginatedResult } from '../../types/pagination';

@Injectable({ providedIn: 'root' })
export class OrderService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiUrl;

  placeOrder(dto: CreateOrderDto) {
    return this.http.post<Order>(this.baseUrl + 'orders', dto);
  }

  getEaterOrders(pageNumber = 1, pageSize = 10, status?: OrderStatus) {
    let params = new HttpParams()
      .set('pageNumber', pageNumber)
      .set('pageSize', pageSize);
    if (status !== undefined) params = params.set('status', status);
    return this.http.get<PaginatedResult<Order>>(this.baseUrl + 'orders/eater', { params });
  }

  getCookOrders(pageNumber = 1, pageSize = 10, status?: OrderStatus) {
    let params = new HttpParams()
      .set('pageNumber', pageNumber)
      .set('pageSize', pageSize);
    if (status !== undefined) params = params.set('status', status);
    return this.http.get<PaginatedResult<Order>>(this.baseUrl + 'orders/cook', { params });
  }

  getOrder(id: number) {
    return this.http.get<Order>(this.baseUrl + `orders/${id}`);
  }

  updateStatus(id: number, dto: UpdateOrderStatusDto) {
    return this.http.put<Order>(this.baseUrl + `orders/${id}/status`, dto);
  }

  cancelOrder(id: number, dto: CancelOrderDto) {
    return this.http.put<Order>(this.baseUrl + `orders/${id}/cancel`, dto);
  }

  sendMessage(orderId: number, content: string) {
    return this.http.post<OrderMessage>(this.baseUrl + `orders/${orderId}/messages`, { content });
  }

  getMessages(orderId: number) {
    return this.http.get<OrderMessage[]>(this.baseUrl + `orders/${orderId}/messages`);
  }

  createCheckoutSession(orderId: number) {
    return this.http.post<{ sessionUrl: string }>(this.baseUrl + 'payments/checkout-session', { orderId });
  }
}
