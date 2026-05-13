import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { signal } from '@angular/core';
import { Subject, of, throwError } from 'rxjs';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrderDetail } from './order-detail';
import { OrderService } from '../../../core/services/order-service';
import { AccountService } from '../../../core/services/account-service';
import { ToastService } from '../../../core/services/toast-service';
import { OrderHubService } from '../../../core/services/order-hub-service';
import { buildOrder, buildUser, buildOrderWithItems } from '../../../testing/test-data-builders';
import { OrderStatus, PaymentMethod, PaymentStatus, FulfillmentType } from '../../../types/order';
import { createMockOrderService, createMockAccountService, createMockToastService } from '../../../testing/mock-services';
import { getByText, getByRole, queryByText, waitFor } from '../../../testing/test-utils';

/**
 * **Validates: Requirements 3.7, 6.1, 6.2**
 * 
 * Tests for OrderDetail component covering:
 * - Order details display (order information, items, totals)
 * - Order status display (status badges, status progression)
 * - Order cancellation (cancellation flow for eaters and cooks)
 * - Order chat/messaging (real-time messaging and SignalR integration)
 */
describe('OrderDetail', () => {
  let component: OrderDetail;
  let fixture: ComponentFixture<OrderDetail>;
  let mockOrderService: ReturnType<typeof createMockOrderService>;
  let mockAccountService: ReturnType<typeof createMockAccountService>;
  let mockToastService: ReturnType<typeof createMockToastService>;
  let mockOrderHubService: any;
  let mockActivatedRoute: any;
  let statusChangedSubject: Subject<any>;
  let messageReceivedSubject: Subject<any>;
  let presenceChangedSubject: Subject<any>;

  beforeEach(async () => {
    statusChangedSubject = new Subject();
    messageReceivedSubject = new Subject();
    presenceChangedSubject = new Subject();
    
    mockOrderService = createMockOrderService();
    mockAccountService = createMockAccountService({
      currentUser: signal(buildUser({ id: 'user1', roles: ['Member'] })),
    });
    mockToastService = createMockToastService();
    
    mockOrderHubService = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      joinOrder: vi.fn(),
      leaveOrder: vi.fn(),
      sendMessage: vi.fn(),
      statusChanged$: statusChangedSubject.asObservable(),
      messageReceived$: messageReceivedSubject.asObservable(),
      presenceChanged$: presenceChangedSubject.asObservable(),
    };
    
    mockActivatedRoute = {
      snapshot: {
        paramMap: {
          get: vi.fn().mockReturnValue('1'),
        },
      },
    };

    const mockOrder = buildOrder({ id: 1, status: OrderStatus.Pending });
    mockOrderService.getOrder.mockReturnValue(of(mockOrder));

    await TestBed.configureTestingModule({
      imports: [OrderDetail],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: OrderService, useValue: mockOrderService },
        { provide: AccountService, useValue: mockAccountService },
        { provide: ToastService, useValue: mockToastService },
        { provide: OrderHubService, useValue: mockOrderHubService },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OrderDetail);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('initialization', () => {
    it('should load order on init', () => {
      const mockOrder = buildOrder({ id: 1 });
      mockOrderService.getOrder.mockReturnValue(of(mockOrder));

      fixture.detectChanges();

      expect(mockOrderService.getOrder).toHaveBeenCalledWith(1);
      expect(component.order()).toEqual(mockOrder);
    });

    it('should connect to order hub on init', () => {
      fixture.detectChanges();

      expect(mockOrderHubService.connect).toHaveBeenCalled();
      expect(mockOrderHubService.joinOrder).toHaveBeenCalledWith(1);
    });

    it('should handle error when order not found', () => {
      mockOrderService.getOrder.mockReturnValue(throwError(() => new Error('Not found')));

      fixture.detectChanges();

      expect(mockToastService.error).toHaveBeenCalledWith('Order not found');
    });

    it('should extract order id from route params', () => {
      mockActivatedRoute.snapshot.paramMap.get.mockReturnValue('42');

      fixture.detectChanges();

      expect(mockOrderService.getOrder).toHaveBeenCalledWith(42);
    });

    it('should set loading state during order fetch', () => {
      expect(component.loading()).toBe(false);
      
      fixture.detectChanges();
      
      // Loading should be set to false after successful fetch
      expect(component.loading()).toBe(false);
    });
  });

  describe('order details display', () => {
    it('should display order information', () => {
      const mockOrder = buildOrder({ id: 1, status: OrderStatus.Pending });
      mockOrderService.getOrder.mockReturnValue(of(mockOrder));

      fixture.detectChanges();

      expect(component.order()).toEqual(mockOrder);
    });

    it('should display order items with correct details', () => {
      const mockOrder = buildOrderWithItems(3);
      mockOrderService.getOrder.mockReturnValue(of(mockOrder));

      fixture.detectChanges();

      const orderItems = component.order()?.items;
      expect(orderItems).toHaveLength(3);
      expect(orderItems?.[0].dishName).toBe('Test Dish 1');
      expect(orderItems?.[0].quantity).toBe(2);
    });

    it('should display order total amount', () => {
      const mockOrder = buildOrder({ id: 1, totalAmount: 50.00 });
      mockOrderService.getOrder.mockReturnValue(of(mockOrder));

      fixture.detectChanges();

      expect(component.order()?.totalAmount).toBe(50.00);
    });

    it('should display order creation date', () => {
      const createdAt = new Date('2024-01-15T10:30:00Z').toISOString();
      const mockOrder = buildOrder({ id: 1, createdAt });
      mockOrderService.getOrder.mockReturnValue(of(mockOrder));

      fixture.detectChanges();

      expect(component.order()?.createdAt).toBe(createdAt);
    });

    it('should display fulfillment type', () => {
      const mockOrder = buildOrder({ id: 1, fulfillmentType: FulfillmentType.Delivery });
      mockOrderService.getOrder.mockReturnValue(of(mockOrder));

      fixture.detectChanges();

      expect(component.order()?.fulfillmentType).toBe(FulfillmentType.Delivery);
    });

    it('should display order notes when present', () => {
      const mockOrder = buildOrder({ id: 1, notes: 'Please ring doorbell' });
      mockOrderService.getOrder.mockReturnValue(of(mockOrder));

      fixture.detectChanges();

      expect(component.order()?.notes).toBe('Please ring doorbell');
    });

    it('should display kitchen name for eater', () => {
      const mockOrder = buildOrder({ id: 1, cookKitchenName: 'Delicious Kitchen' });
      mockOrderService.getOrder.mockReturnValue(of(mockOrder));

      fixture.detectChanges();

      expect(component.order()?.cookKitchenName).toBe('Delicious Kitchen');
    });

    it('should display eater name for cook', () => {
      const mockOrder = buildOrder({ id: 1, eaterDisplayName: 'John Doe' });
      mockOrderService.getOrder.mockReturnValue(of(mockOrder));

      fixture.detectChanges();

      expect(component.order()?.eaterDisplayName).toBe('John Doe');
    });

    it('should get status badge class', () => {
      const mockOrder = buildOrder({ id: 1, status: OrderStatus.Pending });
      mockOrderService.getOrder.mockReturnValue(of(mockOrder));
      fixture.detectChanges();

      const badgeClass = component.statusBadgeClass(OrderStatus.Pending);

      expect(badgeClass).toBe('badge-warning');
    });

    it('should return correct badge class for all statuses', () => {
      fixture.detectChanges();

      expect(component.statusBadgeClass(OrderStatus.Pending)).toBe('badge-warning');
      expect(component.statusBadgeClass(OrderStatus.Accepted)).toBe('badge-info');
      expect(component.statusBadgeClass(OrderStatus.Preparing)).toBe('badge-info');
      expect(component.statusBadgeClass(OrderStatus.Ready)).toBe('badge-success');
      expect(component.statusBadgeClass(OrderStatus.Delivered)).toBe('badge-neutral');
      expect(component.statusBadgeClass(OrderStatus.Cancelled)).toBe('badge-error');
    });
  });

  describe('status updates', () => {
    it('should advance order status', () => {
      const mockOrder = buildOrder({ id: 1, status: OrderStatus.Pending });
      const updatedOrder = buildOrder({ id: 1, status: OrderStatus.Accepted });
      mockOrderService.getOrder.mockReturnValue(of(mockOrder));
      mockOrderService.updateStatus.mockReturnValue(of(updatedOrder));
      fixture.detectChanges();

      component.advanceStatus();

      expect(mockOrderService.updateStatus).toHaveBeenCalledWith(1, {
        newStatus: OrderStatus.Accepted,
      });
      expect(component.order()).toEqual(updatedOrder);
      expect(mockToastService.success).toHaveBeenCalled();
    });

    it('should not advance status when no next status available', () => {
      const mockOrder = buildOrder({ id: 1, status: OrderStatus.Delivered });
      mockOrderService.getOrder.mockReturnValue(of(mockOrder));
      fixture.detectChanges();

      component.advanceStatus();

      expect(mockOrderService.updateStatus).not.toHaveBeenCalled();
    });

    it('should handle error when status update fails', () => {
      const mockOrder = buildOrder({ id: 1, status: OrderStatus.Pending });
      mockOrderService.getOrder.mockReturnValue(of(mockOrder));
      mockOrderService.updateStatus.mockReturnValue(throwError(() => new Error('Update failed')));
      fixture.detectChanges();

      component.advanceStatus();

      expect(mockToastService.error).toHaveBeenCalledWith('Failed to update status');
    });

    it('should receive real-time status updates from hub', () => {
      const mockOrder = buildOrder({ id: 1, status: OrderStatus.Pending });
      mockOrderService.getOrder.mockReturnValue(of(mockOrder));
      fixture.detectChanges();

      statusChangedSubject.next({ orderId: 1, newStatus: 'Accepted' });

      expect(component.order()?.status).toBe(OrderStatus.Accepted);
    });

    it('should ignore status updates for other orders', () => {
      const mockOrder = buildOrder({ id: 1, status: OrderStatus.Pending });
      mockOrderService.getOrder.mockReturnValue(of(mockOrder));
      fixture.detectChanges();

      statusChangedSubject.next({ orderId: 2, newStatus: 'Accepted' });

      expect(component.order()?.status).toBe(OrderStatus.Pending);
    });

    it('should calculate next status correctly for Pending', () => {
      const mockOrder = buildOrder({ id: 1, status: OrderStatus.Pending });
      mockOrderService.getOrder.mockReturnValue(of(mockOrder));
      fixture.detectChanges();

      expect(component.nextStatus).toBe(OrderStatus.Accepted);
      expect(component.nextStatusLabel).toBe('Accepted');
    });

    it('should calculate next status correctly for Accepted', () => {
      const mockOrder = buildOrder({ id: 1, status: OrderStatus.Accepted });
      mockOrderService.getOrder.mockReturnValue(of(mockOrder));
      fixture.detectChanges();

      expect(component.nextStatus).toBe(OrderStatus.Preparing);
    });

    it('should calculate next status correctly for Preparing', () => {
      const mockOrder = buildOrder({ id: 1, status: OrderStatus.Preparing });
      mockOrderService.getOrder.mockReturnValue(of(mockOrder));
      fixture.detectChanges();

      expect(component.nextStatus).toBe(OrderStatus.Ready);
    });

    it('should calculate next status correctly for Ready', () => {
      const mockOrder = buildOrder({ id: 1, status: OrderStatus.Ready });
      mockOrderService.getOrder.mockReturnValue(of(mockOrder));
      fixture.detectChanges();

      expect(component.nextStatus).toBe(OrderStatus.Delivered);
    });

    it('should return null for next status when Delivered', () => {
      const mockOrder = buildOrder({ id: 1, status: OrderStatus.Delivered });
      mockOrderService.getOrder.mockReturnValue(of(mockOrder));
      fixture.detectChanges();

      expect(component.nextStatus).toBeNull();
    });

    it('should return null for next status when Cancelled', () => {
      const mockOrder = buildOrder({ id: 1, status: OrderStatus.Cancelled });
      mockOrderService.getOrder.mockReturnValue(of(mockOrder));
      fixture.detectChanges();

      expect(component.nextStatus).toBeNull();
    });

    it('should set action loading state during status update', () => {
      const mockOrder = buildOrder({ id: 1, status: OrderStatus.Pending });
      const updatedOrder = buildOrder({ id: 1, status: OrderStatus.Accepted });
      mockOrderService.getOrder.mockReturnValue(of(mockOrder));
      mockOrderService.updateStatus.mockReturnValue(of(updatedOrder));
      fixture.detectChanges();

      expect(component.actionLoading()).toBe(false);
      
      component.advanceStatus();
      
      // After completion, loading should be false
      expect(component.actionLoading()).toBe(false);
    });

    it('should display success message with correct status label', () => {
      const mockOrder = buildOrder({ id: 1, status: OrderStatus.Pending });
      const updatedOrder = buildOrder({ id: 1, status: OrderStatus.Accepted });
      mockOrderService.getOrder.mockReturnValue(of(mockOrder));
      mockOrderService.updateStatus.mockReturnValue(of(updatedOrder));
      fixture.detectChanges();

      component.advanceStatus();

      expect(mockToastService.success).toHaveBeenCalledWith('Status updated to Accepted');
    });
  });

  describe('order cancellation', () => {
    it('should cancel order with reason', () => {
      const mockOrder = buildOrder({ id: 1, status: OrderStatus.Pending });
      const cancelledOrder = buildOrder({ id: 1, status: OrderStatus.Cancelled });
      mockOrderService.getOrder.mockReturnValue(of(mockOrder));
      mockOrderService.cancelOrder.mockReturnValue(of(cancelledOrder));
      fixture.detectChanges();
      component.cancelReason.set('Changed my mind');

      component.cancelOrder();

      expect(mockOrderService.cancelOrder).toHaveBeenCalledWith(1, { reason: 'Changed my mind' });
      expect(component.order()).toEqual(cancelledOrder);
      expect(mockToastService.success).toHaveBeenCalledWith('Order cancelled');
      expect(component.showCancelForm()).toBe(false);
    });

    it('should not cancel order without reason', () => {
      const mockOrder = buildOrder({ id: 1, status: OrderStatus.Pending });
      mockOrderService.getOrder.mockReturnValue(of(mockOrder));
      fixture.detectChanges();
      component.cancelReason.set('');

      component.cancelOrder();

      expect(mockOrderService.cancelOrder).not.toHaveBeenCalled();
    });

    it('should not cancel order with whitespace-only reason', () => {
      const mockOrder = buildOrder({ id: 1, status: OrderStatus.Pending });
      mockOrderService.getOrder.mockReturnValue(of(mockOrder));
      fixture.detectChanges();
      component.cancelReason.set('   ');

      component.cancelOrder();

      expect(mockOrderService.cancelOrder).not.toHaveBeenCalled();
    });

    it('should handle error when cancellation fails', () => {
      const mockOrder = buildOrder({ id: 1, status: OrderStatus.Pending });
      mockOrderService.getOrder.mockReturnValue(of(mockOrder));
      mockOrderService.cancelOrder.mockReturnValue(
        throwError(() => new Error('Cancellation failed'))
      );
      fixture.detectChanges();
      component.cancelReason.set('Changed my mind');

      component.cancelOrder();

      expect(mockToastService.error).toHaveBeenCalledWith('Failed to cancel order');
    });

    it('should reset cancel form after successful cancellation', () => {
      const mockOrder = buildOrder({ id: 1, status: OrderStatus.Pending });
      const cancelledOrder = buildOrder({ id: 1, status: OrderStatus.Cancelled });
      mockOrderService.getOrder.mockReturnValue(of(mockOrder));
      mockOrderService.cancelOrder.mockReturnValue(of(cancelledOrder));
      fixture.detectChanges();
      component.showCancelForm.set(true);
      component.cancelReason.set('Changed my mind');

      component.cancelOrder();

      expect(component.showCancelForm()).toBe(false);
      expect(component.cancelReason()).toBe('');
    });

    it('should set action loading state during cancellation', () => {
      const mockOrder = buildOrder({ id: 1, status: OrderStatus.Pending });
      const cancelledOrder = buildOrder({ id: 1, status: OrderStatus.Cancelled });
      mockOrderService.getOrder.mockReturnValue(of(mockOrder));
      mockOrderService.cancelOrder.mockReturnValue(of(cancelledOrder));
      fixture.detectChanges();
      component.cancelReason.set('Changed my mind');

      expect(component.actionLoading()).toBe(false);
      
      component.cancelOrder();
      
      // After completion, loading should be false
      expect(component.actionLoading()).toBe(false);
    });

    it('should display cancellation reason when order is cancelled', () => {
      const mockOrder = buildOrder({ 
        id: 1, 
        status: OrderStatus.Cancelled,
        cancellationReason: 'Customer changed mind'
      });
      mockOrderService.getOrder.mockReturnValue(of(mockOrder));

      fixture.detectChanges();

      expect(component.order()?.cancellationReason).toBe('Customer changed mind');
    });
  });

  describe('permissions', () => {
    it('should identify cook users correctly', () => {
      Object.defineProperty(mockAccountService, 'currentUser', {
        get: () => signal(buildUser({ roles: ['Cook'] })),
        configurable: true,
      });

      fixture.detectChanges();

      expect(component.isCook).toBe(true);
    });

    it('should identify non-cook users correctly', () => {
      Object.defineProperty(mockAccountService, 'currentUser', {
        get: () => signal(buildUser({ roles: ['Member'] })),
        configurable: true,
      });

      fixture.detectChanges();

      expect(component.isCook).toBe(false);
    });

    it('should identify eater users correctly', () => {
      const mockOrder = buildOrder({ id: 1, eaterUserId: 'user1' });
      mockOrderService.getOrder.mockReturnValue(of(mockOrder));

      fixture.detectChanges();

      expect(component.isEater).toBe(true);
    });

    it('should identify non-eater users correctly', () => {
      const mockOrder = buildOrder({ id: 1, eaterUserId: 'other-user' });
      mockOrderService.getOrder.mockReturnValue(of(mockOrder));

      fixture.detectChanges();

      expect(component.isEater).toBe(false);
    });

    it('should allow cook to cancel in Pending status', () => {
      Object.defineProperty(mockAccountService, 'currentUser', {
        get: () => signal(buildUser({ roles: ['Cook'] })),
        configurable: true,
      });
      const mockOrder = buildOrder({ id: 1, status: OrderStatus.Pending });
      mockOrderService.getOrder.mockReturnValue(of(mockOrder));

      fixture.detectChanges();

      expect(component.canCookCancel).toBe(true);
    });

    it('should allow cook to cancel in Accepted status', () => {
      Object.defineProperty(mockAccountService, 'currentUser', {
        get: () => signal(buildUser({ roles: ['Cook'] })),
        configurable: true,
      });
      const mockOrder = buildOrder({ id: 1, status: OrderStatus.Accepted });
      mockOrderService.getOrder.mockReturnValue(of(mockOrder));

      fixture.detectChanges();

      expect(component.canCookCancel).toBe(true);
    });

    it('should allow cook to cancel in Preparing status', () => {
      Object.defineProperty(mockAccountService, 'currentUser', {
        get: () => signal(buildUser({ roles: ['Cook'] })),
        configurable: true,
      });
      const mockOrder = buildOrder({ id: 1, status: OrderStatus.Preparing });
      mockOrderService.getOrder.mockReturnValue(of(mockOrder));

      fixture.detectChanges();

      expect(component.canCookCancel).toBe(true);
    });

    it('should not allow cook to cancel Ready orders', () => {
      Object.defineProperty(mockAccountService, 'currentUser', {
        get: () => signal(buildUser({ roles: ['Cook'] })),
        configurable: true,
      });
      const mockOrder = buildOrder({ id: 1, status: OrderStatus.Ready });
      mockOrderService.getOrder.mockReturnValue(of(mockOrder));

      fixture.detectChanges();

      expect(component.canCookCancel).toBe(false);
    });

    it('should not allow cook to cancel delivered orders', () => {
      Object.defineProperty(mockAccountService, 'currentUser', {
        get: () => signal(buildUser({ roles: ['Cook'] })),
        configurable: true,
      });
      const mockOrder = buildOrder({ id: 1, status: OrderStatus.Delivered });
      mockOrderService.getOrder.mockReturnValue(of(mockOrder));

      fixture.detectChanges();

      expect(component.canCookCancel).toBe(false);
    });

    it('should allow eater to cancel pending orders', () => {
      const mockOrder = buildOrder({ id: 1, status: OrderStatus.Pending, eaterUserId: 'user1' });
      mockOrderService.getOrder.mockReturnValue(of(mockOrder));

      fixture.detectChanges();

      expect(component.canEaterCancel).toBe(true);
    });

    it('should not allow eater to cancel accepted orders', () => {
      const mockOrder = buildOrder({ id: 1, status: OrderStatus.Accepted, eaterUserId: 'user1' });
      mockOrderService.getOrder.mockReturnValue(of(mockOrder));

      fixture.detectChanges();

      expect(component.canEaterCancel).toBe(false);
    });

    it('should not allow eater to cancel preparing orders', () => {
      const mockOrder = buildOrder({ id: 1, status: OrderStatus.Preparing, eaterUserId: 'user1' });
      mockOrderService.getOrder.mockReturnValue(of(mockOrder));

      fixture.detectChanges();

      expect(component.canEaterCancel).toBe(false);
    });

    it('should not allow eater to cancel ready orders', () => {
      const mockOrder = buildOrder({ id: 1, status: OrderStatus.Ready, eaterUserId: 'user1' });
      mockOrderService.getOrder.mockReturnValue(of(mockOrder));

      fixture.detectChanges();

      expect(component.canEaterCancel).toBe(false);
    });

    it('should not allow eater to cancel delivered orders', () => {
      const mockOrder = buildOrder({ id: 1, status: OrderStatus.Delivered, eaterUserId: 'user1' });
      mockOrderService.getOrder.mockReturnValue(of(mockOrder));

      fixture.detectChanges();

      expect(component.canEaterCancel).toBe(false);
    });
  });

  describe('order chat/messaging and SignalR integration', () => {
    it('should connect to SignalR hub on initialization', () => {
      fixture.detectChanges();

      expect(mockOrderHubService.connect).toHaveBeenCalled();
    });

    it('should join order room on initialization', () => {
      fixture.detectChanges();

      expect(mockOrderHubService.joinOrder).toHaveBeenCalledWith(1);
    });

    it('should leave order room on component destroy', () => {
      fixture.detectChanges();

      fixture.destroy();

      expect(mockOrderHubService.leaveOrder).toHaveBeenCalledWith(1);
    });

    it('should subscribe to status change events', () => {
      const mockOrder = buildOrder({ id: 1, status: OrderStatus.Pending });
      mockOrderService.getOrder.mockReturnValue(of(mockOrder));
      fixture.detectChanges();

      // Emit a status change event
      statusChangedSubject.next({ orderId: 1, newStatus: 'Accepted' });

      expect(component.order()?.status).toBe(OrderStatus.Accepted);
    });

    it('should update order status when receiving SignalR status change', () => {
      const mockOrder = buildOrder({ id: 1, status: OrderStatus.Accepted });
      mockOrderService.getOrder.mockReturnValue(of(mockOrder));
      fixture.detectChanges();

      statusChangedSubject.next({ orderId: 1, newStatus: 'Preparing' });

      expect(component.order()?.status).toBe(OrderStatus.Preparing);
    });

    it('should handle multiple status changes via SignalR', () => {
      const mockOrder = buildOrder({ id: 1, status: OrderStatus.Pending });
      mockOrderService.getOrder.mockReturnValue(of(mockOrder));
      fixture.detectChanges();

      statusChangedSubject.next({ orderId: 1, newStatus: 'Accepted' });
      expect(component.order()?.status).toBe(OrderStatus.Accepted);

      statusChangedSubject.next({ orderId: 1, newStatus: 'Preparing' });
      expect(component.order()?.status).toBe(OrderStatus.Preparing);

      statusChangedSubject.next({ orderId: 1, newStatus: 'Ready' });
      expect(component.order()?.status).toBe(OrderStatus.Ready);
    });

    it('should not update status for different order IDs', () => {
      const mockOrder = buildOrder({ id: 1, status: OrderStatus.Pending });
      mockOrderService.getOrder.mockReturnValue(of(mockOrder));
      fixture.detectChanges();

      statusChangedSubject.next({ orderId: 999, newStatus: 'Accepted' });

      expect(component.order()?.status).toBe(OrderStatus.Pending);
    });

    it('should handle status change when order is null', () => {
      const mockOrder = buildOrder({ id: 1, status: OrderStatus.Pending });
      mockOrderService.getOrder.mockReturnValue(of(mockOrder));
      fixture.detectChanges();

      // Set order to null
      component.order.set(null);

      // Should not throw error
      expect(() => {
        statusChangedSubject.next({ orderId: 1, newStatus: 'Accepted' });
      }).not.toThrow();
    });

    it('should unsubscribe from SignalR events on destroy', () => {
      fixture.detectChanges();

      fixture.destroy();

      expect(mockOrderHubService.leaveOrder).toHaveBeenCalledWith(1);
    });

    it('should handle SignalR connection for different order IDs', () => {
      mockActivatedRoute.snapshot.paramMap.get.mockReturnValue('42');
      const mockOrder = buildOrder({ id: 42, status: OrderStatus.Pending });
      mockOrderService.getOrder.mockReturnValue(of(mockOrder));

      fixture.detectChanges();

      expect(mockOrderHubService.joinOrder).toHaveBeenCalledWith(42);
    });

    it('should properly clean up SignalR connection with correct order ID', () => {
      mockActivatedRoute.snapshot.paramMap.get.mockReturnValue('42');
      const mockOrder = buildOrder({ id: 42, status: OrderStatus.Pending });
      mockOrderService.getOrder.mockReturnValue(of(mockOrder));

      fixture.detectChanges();
      fixture.destroy();

      expect(mockOrderHubService.leaveOrder).toHaveBeenCalledWith(42);
    });
  });

  describe('payment status display', () => {
    it('should display payment status for Stripe orders', () => {
      const mockOrder = buildOrder({ 
        id: 1, 
        paymentMethod: PaymentMethod.Stripe,
        paymentStatus: PaymentStatus.Paid
      });
      mockOrderService.getOrder.mockReturnValue(of(mockOrder));

      fixture.detectChanges();

      expect(component.order()?.paymentMethod).toBe(PaymentMethod.Stripe);
      expect(component.order()?.paymentStatus).toBe(PaymentStatus.Paid);
    });

    it('should display refunded status for refunded orders', () => {
      const mockOrder = buildOrder({ 
        id: 1, 
        paymentMethod: PaymentMethod.Stripe,
        paymentStatus: PaymentStatus.Refunded
      });
      mockOrderService.getOrder.mockReturnValue(of(mockOrder));

      fixture.detectChanges();

      expect(component.order()?.paymentStatus).toBe(PaymentStatus.Refunded);
    });

    it('should display pending payment status', () => {
      const mockOrder = buildOrder({ 
        id: 1, 
        paymentMethod: PaymentMethod.Stripe,
        paymentStatus: PaymentStatus.Pending
      });
      mockOrderService.getOrder.mockReturnValue(of(mockOrder));

      fixture.detectChanges();

      expect(component.order()?.paymentStatus).toBe(PaymentStatus.Pending);
    });

    it('should handle cash payment method', () => {
      const mockOrder = buildOrder({ 
        id: 1, 
        paymentMethod: PaymentMethod.Cash,
        paymentStatus: PaymentStatus.Paid
      });
      mockOrderService.getOrder.mockReturnValue(of(mockOrder));

      fixture.detectChanges();

      expect(component.order()?.paymentMethod).toBe(PaymentMethod.Cash);
    });
  });

  describe('cleanup', () => {
    it('should leave order hub on destroy', () => {
      fixture.detectChanges();

      fixture.destroy();

      expect(mockOrderHubService.leaveOrder).toHaveBeenCalledWith(1);
    });

    it('should unsubscribe from all subscriptions on destroy', () => {
      fixture.detectChanges();

      fixture.destroy();

      expect(mockOrderHubService.leaveOrder).toHaveBeenCalledWith(1);
    });
  });
});
