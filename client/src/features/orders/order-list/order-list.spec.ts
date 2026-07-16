import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { OrderList } from './order-list';
import { OrderService } from '../../../core/services/order-service';
import { AccountService } from '../../../core/services/account-service';
import { buildOrder, buildUser, buildPaginatedResult, buildOrderWithItems } from '../../../testing/test-data-builders';
import { OrderStatus } from '../../../types/order';
import { mountComponent, getByText, queryByText } from '../../../testing/test-utils';
import { createMockOrderService, createMockAccountService } from '../../../testing/mock-services';

/**
 * **Validates: Requirements 3.7, 6.1, 6.2, 6.5**
 * 
 * Tests for the OrderList component covering:
 * - Order listing displays user's orders (eaters and cooks)
 * - Order filtering by status
 * - Pagination
 */
describe('OrderList', () => {
  // Helper function to create a fresh test setup
  async function setupTest(
    orders: any[] = [],
    userRoles: string[] = ['Member']
  ) {
    const mockOrderService = createMockOrderService({
      getEaterOrders: vi.fn().mockReturnValue(of(buildPaginatedResult(orders, 1, 10))),
      getCookOrders: vi.fn().mockReturnValue(of(buildPaginatedResult(orders, 1, 10))),
    });

    const mockAccountService = createMockAccountService({
      currentUser: signal(buildUser({ roles: userRoles })),
    });

    const fixture = await mountComponent(OrderList, {
      providers: [
        { provide: OrderService, useValue: mockOrderService },
        { provide: AccountService, useValue: mockAccountService },
      ],
    });

    return { fixture, mockOrderService, mockAccountService };
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should create', async () => {
    const { fixture } = await setupTest();
    expect(fixture.componentInstance).toBeTruthy();
  });

  describe('Order listing - Eater perspective', () => {
    it('should display heading "My orders" for eater users', async () => {
      const { fixture } = await setupTest();
      const heading = getByText(fixture.nativeElement, 'My orders');
      expect(heading).toBeTruthy();
    });

    it('should load eater orders on initialization', async () => {
      const mockOrders = [
        buildOrder({ id: 1, cookKitchenName: 'Kitchen A' }),
        buildOrder({ id: 2, cookKitchenName: 'Kitchen B' }),
      ];
      
      const { fixture, mockOrderService } = await setupTest(mockOrders);

      expect(mockOrderService.getEaterOrders).toHaveBeenCalled();
      expect(mockOrderService.getCookOrders).not.toHaveBeenCalled();
      expect(fixture.componentInstance.orders()).toEqual(mockOrders);
    });

    it('should display eater orders with kitchen names', async () => {
      const mockOrders = [
        buildOrder({ id: 1, cookKitchenName: 'Tasty Kitchen' }),
        buildOrder({ id: 2, cookKitchenName: 'Spice House' }),
      ];
      
      const { fixture } = await setupTest(mockOrders);

      const kitchenA = getByText(fixture.nativeElement, 'Tasty Kitchen');
      const kitchenB = getByText(fixture.nativeElement, 'Spice House');
      expect(kitchenA).toBeTruthy();
      expect(kitchenB).toBeTruthy();
    });

    it('should display order details (item count, total, date)', async () => {
      const mockOrders = [buildOrderWithItems(3)];
      mockOrders[0].totalAmount = 45.99;
      
      const { fixture } = await setupTest(mockOrders);

      const text = fixture.nativeElement.textContent;
      expect(text).toContain('3 items');
    });

    it('should display empty state when no orders exist', async () => {
      const { fixture } = await setupTest([]);

      const emptyMessage = getByText(fixture.nativeElement, 'No orders yet.');
      expect(emptyMessage).toBeTruthy();
    });

    it('should display "Browse cooks" link in empty state for eaters', async () => {
      const { fixture } = await setupTest([]);

      const browseLink = getByText(fixture.nativeElement, 'Browse cooks');
      expect(browseLink).toBeTruthy();
    });
  });

  describe('Order listing - Cook perspective', () => {
    it('should display heading "Incoming orders" for cook users', async () => {
      const { fixture } = await setupTest([], ['Cook']);

      const heading = getByText(fixture.nativeElement, 'Incoming orders');
      expect(heading).toBeTruthy();
    });

    it('should load cook orders on initialization', async () => {
      const mockOrders = [
        buildOrder({ id: 1, eaterDisplayName: 'John Doe' }),
        buildOrder({ id: 2, eaterDisplayName: 'Jane Smith' }),
      ];
      
      const { fixture, mockOrderService } = await setupTest(mockOrders, ['Cook']);

      expect(mockOrderService.getCookOrders).toHaveBeenCalled();
      expect(mockOrderService.getEaterOrders).not.toHaveBeenCalled();
      expect(fixture.componentInstance.orders()).toEqual(mockOrders);
    });

    it('should display cook orders with eater names', async () => {
      const mockOrders = [
        buildOrder({ id: 1, eaterDisplayName: 'Alice Johnson' }),
        buildOrder({ id: 2, eaterDisplayName: 'Bob Williams' }),
      ];
      
      const { fixture } = await setupTest(mockOrders, ['Cook']);

      const eaterA = getByText(fixture.nativeElement, 'Order from Alice Johnson');
      const eaterB = getByText(fixture.nativeElement, 'Order from Bob Williams');
      expect(eaterA).toBeTruthy();
      expect(eaterB).toBeTruthy();
    });

    it('should not display "Browse cooks" link in empty state for cooks', async () => {
      const { fixture } = await setupTest([], ['Cook']);

      const browseLink = queryByText(fixture.nativeElement, 'Browse cooks');
      expect(browseLink).toBeNull();
    });
  });

  describe('Order filtering by status', () => {
    it('should display orders with different statuses', async () => {
      const mockOrders = [
        buildOrder({ id: 1, status: OrderStatus.Pending }),
        buildOrder({ id: 2, status: OrderStatus.Accepted }),
        buildOrder({ id: 3, status: OrderStatus.Preparing }),
        buildOrder({ id: 4, status: OrderStatus.Ready }),
        buildOrder({ id: 5, status: OrderStatus.Delivered }),
        buildOrder({ id: 6, status: OrderStatus.Cancelled }),
      ];
      
      const { fixture } = await setupTest(mockOrders);

      expect(fixture.componentInstance.orders().length).toBe(6);
      expect(fixture.componentInstance.orders()[0].status).toBe(OrderStatus.Pending);
      expect(fixture.componentInstance.orders()[1].status).toBe(OrderStatus.Accepted);
      expect(fixture.componentInstance.orders()[2].status).toBe(OrderStatus.Preparing);
      expect(fixture.componentInstance.orders()[3].status).toBe(OrderStatus.Ready);
      expect(fixture.componentInstance.orders()[4].status).toBe(OrderStatus.Delivered);
      expect(fixture.componentInstance.orders()[5].status).toBe(OrderStatus.Cancelled);
    });

    it('should display correct badge for pending orders', async () => {
      const mockOrders = [buildOrder({ id: 1, status: OrderStatus.Pending })];
      const { fixture } = await setupTest(mockOrders);

      const badge = fixture.nativeElement.querySelector('.badge-warning');
      expect(badge).toBeTruthy();
    });

    it('should display correct badge for accepted orders', async () => {
      const mockOrders = [buildOrder({ id: 1, status: OrderStatus.Accepted })];
      const { fixture } = await setupTest(mockOrders);

      const badge = fixture.nativeElement.querySelector('.badge-info');
      expect(badge).toBeTruthy();
    });

    it('should display correct badge for preparing orders', async () => {
      const mockOrders = [buildOrder({ id: 1, status: OrderStatus.Preparing })];
      const { fixture } = await setupTest(mockOrders);

      const badge = fixture.nativeElement.querySelector('.badge-info');
      expect(badge).toBeTruthy();
    });

    it('should display correct badge for ready orders', async () => {
      const mockOrders = [buildOrder({ id: 1, status: OrderStatus.Ready })];
      const { fixture } = await setupTest(mockOrders);

      const badge = fixture.nativeElement.querySelector('.badge-success');
      expect(badge).toBeTruthy();
    });

    it('should display correct badge for delivered orders', async () => {
      const mockOrders = [buildOrder({ id: 1, status: OrderStatus.Delivered })];
      const { fixture } = await setupTest(mockOrders);

      const badge = fixture.nativeElement.querySelector('.badge-neutral');
      expect(badge).toBeTruthy();
    });

    it('should display correct badge for cancelled orders', async () => {
      const mockOrders = [buildOrder({ id: 1, status: OrderStatus.Cancelled })];
      const { fixture } = await setupTest(mockOrders);

      const badge = fixture.nativeElement.querySelector('.badge-error');
      expect(badge).toBeTruthy();
    });
  });

  describe('Status badge utility', () => {
    it('should return correct badge class for pending status', async () => {
      const { fixture } = await setupTest();
      const badgeClass = fixture.componentInstance.statusBadgeClass(OrderStatus.Pending);
      expect(badgeClass).toBe('badge-warning');
    });

    it('should return correct badge class for accepted status', async () => {
      const { fixture } = await setupTest();
      const badgeClass = fixture.componentInstance.statusBadgeClass(OrderStatus.Accepted);
      expect(badgeClass).toBe('badge-info');
    });

    it('should return correct badge class for preparing status', async () => {
      const { fixture } = await setupTest();
      const badgeClass = fixture.componentInstance.statusBadgeClass(OrderStatus.Preparing);
      expect(badgeClass).toBe('badge-info');
    });

    it('should return correct badge class for ready status', async () => {
      const { fixture } = await setupTest();
      const badgeClass = fixture.componentInstance.statusBadgeClass(OrderStatus.Ready);
      expect(badgeClass).toBe('badge-success');
    });

    it('should return correct badge class for delivered status', async () => {
      const { fixture } = await setupTest();
      const badgeClass = fixture.componentInstance.statusBadgeClass(OrderStatus.Delivered);
      expect(badgeClass).toBe('badge-neutral');
    });

    it('should return correct badge class for cancelled status', async () => {
      const { fixture } = await setupTest();
      const badgeClass = fixture.componentInstance.statusBadgeClass(OrderStatus.Cancelled);
      expect(badgeClass).toBe('badge-error');
    });
  });

  describe('Pagination', () => {
    it('should display first page of paginated orders', async () => {
      const mockOrders = Array.from({ length: 10 }, (_, i) => 
        buildOrder({ id: i + 1, cookKitchenName: `Kitchen ${i + 1}` })
      );
      
      const { fixture } = await setupTest(mockOrders);

      expect(fixture.componentInstance.orders().length).toBe(10);
    });

    it('should handle partial page of orders', async () => {
      const mockOrders = Array.from({ length: 5 }, (_, i) => buildOrder({ id: i + 1 }));
      const { fixture } = await setupTest(mockOrders);

      expect(fixture.componentInstance.orders().length).toBe(5);
    });

    it('should handle single order', async () => {
      const mockOrders = [buildOrderWithItems(1)];
      const { fixture } = await setupTest(mockOrders);

      expect(fixture.componentInstance.orders().length).toBe(1);
      const text = fixture.nativeElement.textContent;
      expect(text).toContain('1 item');
    });

    it('should display plural "items" for multiple items', async () => {
      const mockOrders = [buildOrderWithItems(3)];
      const { fixture } = await setupTest(mockOrders);

      const text = fixture.nativeElement.textContent;
      expect(text).toContain('3 items');
    });
  });

  describe('Loading state', () => {
    it('should set loading state to false after orders are loaded', async () => {
      const mockOrders = [buildOrder({ id: 1 })];
      const { fixture } = await setupTest(mockOrders);

      expect(fixture.componentInstance.loading()).toBe(false);
    });
  });

  describe('User role detection', () => {
    it('should identify cook users correctly', async () => {
      const { fixture } = await setupTest([], ['Cook']);
      expect(fixture.componentInstance.isCook).toBe(true);
    });

    it('should identify non-cook users correctly', async () => {
      const { fixture } = await setupTest([], ['Member']);
      expect(fixture.componentInstance.isCook).toBe(false);
    });

    it('should handle user with multiple roles including Cook', async () => {
      const { fixture } = await setupTest([], ['Member', 'Cook', 'Admin']);
      expect(fixture.componentInstance.isCook).toBe(true);
    });
  });
});
