import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { OrderService } from './order-service';
import { FulfillmentType, OrderStatus, PaymentMethod } from '../../types/order';
import { environment } from '../../environments/environment';

describe('OrderService', () => {
  let service: OrderService;
  let http: HttpTestingController;
  const base = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(OrderService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('placeOrder posts to orders endpoint', () => {
    const dto = {
      cookProfileId: 1,
      items: [{ dishId: 5, quantity: 2 }],
      fulfillmentType: FulfillmentType.Pickup,
      paymentMethod: PaymentMethod.Cash,
    };
    service.placeOrder(dto).subscribe();
    const req = http.expectOne(base + 'orders');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(dto);
    req.flush({});
  });

  it('getEaterOrders sets pageNumber and pageSize params', () => {
    service.getEaterOrders(2, 5).subscribe();
    const req = http.expectOne(r => r.url.includes('orders/eater'));
    expect(req.request.params.get('pageNumber')).toBe('2');
    expect(req.request.params.get('pageSize')).toBe('5');
    req.flush({ items: [], totalCount: 0 });
  });

  it('getCookOrders filters by status when provided', () => {
    service.getCookOrders(1, 10, OrderStatus.Pending).subscribe();
    const req = http.expectOne(r => r.url.includes('orders/cook'));
    expect(req.request.params.get('status')).toBe('0');
    req.flush({ items: [], totalCount: 0 });
  });

  it('getOrder fetches single order by id', () => {
    service.getOrder(42).subscribe();
    const req = http.expectOne(base + 'orders/42');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('cancelOrder puts to cancel endpoint', () => {
    service.cancelOrder(7, { reason: 'Changed mind' }).subscribe();
    const req = http.expectOne(base + 'orders/7/cancel');
    expect(req.request.method).toBe('PUT');
    req.flush({});
  });

  it('createCheckoutSession posts orderId', () => {
    service.createCheckoutSession(3).subscribe();
    const req = http.expectOne(base + 'payments/checkout-session');
    expect(req.request.body).toEqual({ orderId: 3 });
    req.flush({ sessionUrl: 'https://stripe.com/pay' });
  });
});
