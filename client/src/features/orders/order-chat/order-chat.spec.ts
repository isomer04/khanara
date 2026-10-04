import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of, Subject } from 'rxjs';
import { vi } from 'vitest';
import { OrderChat } from './order-chat';
import { OrderHubService } from '../../../core/services/order-hub-service';
import { OrderService } from '../../../core/services/order-service';
import { AccountService } from '../../../core/services/account-service';
import { ToastService } from '../../../core/services/toast-service';
import { OrderMessage } from '../../../types/message';
import { OrderStatus } from '../../../types/order';
import { createMockToastService } from '../../../testing/mock-services';

const message = (id: number, content = `message ${id}`): OrderMessage => ({
  id,
  orderId: 7,
  senderId: 'u1',
  senderDisplayName: 'Eater',
  content,
  sentAt: '2026-09-30T19:00:00Z',
});

describe('OrderChat', () => {
  let fixture: ComponentFixture<OrderChat>;
  let component: OrderChat;
  let messageReceived$: Subject<{ orderId: number; message: OrderMessage }>;
  let mockOrderService: { getMessages: ReturnType<typeof vi.fn>; sendMessage: ReturnType<typeof vi.fn> };
  let restored$: Subject<void>;
  let getOrder: ReturnType<typeof vi.fn>;
  let state: ReturnType<typeof signal>;
  let statusChanged$: Subject<any>;

  beforeEach(async () => {
    messageReceived$ = new Subject();
    restored$ = new Subject();
    statusChanged$ = new Subject();
    state = signal('connected');
    getOrder = vi.fn().mockReturnValue(of({ status: OrderStatus.Pending }));
    mockOrderService = {
      getMessages: vi.fn().mockReturnValue(of([message(1)])),
      sendMessage: vi.fn().mockReturnValue(of(message(2, 'hello'))),
    };

    await TestBed.configureTestingModule({
      imports: [OrderChat],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '7' }) } } },
        { provide: OrderService, useValue: { ...mockOrderService, getOrder } },
        { provide: AccountService, useValue: { currentUser: signal({ id: 'u1' }) } },
        { provide: ToastService, useValue: createMockToastService() },
        {
          provide: OrderHubService,
          useValue: {
            connectionState: state,
            connectionRestored$: restored$,
            retry: vi.fn(),
            connect: vi.fn(),
            disconnect: vi.fn(),
            joinOrder: vi.fn().mockResolvedValue(undefined),
            leaveOrder: vi.fn().mockResolvedValue(undefined),
            messageReceived$,
            presenceChanged$: new Subject(),
            statusChanged$,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OrderChat);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  const messageIds = () => component['messages']().map((m) => m.id);

  it('should show a sent message even when the hub never echoes it', () => {
    component['newMessage'].set('hello');

    component.send();

    expect(messageIds()).toEqual([1, 2]);
    expect(component['newMessage']()).toBe('');
  });

  it('should not duplicate a sent message when the hub echo arrives too', () => {
    component['newMessage'].set('hello');
    component.send();

    messageReceived$.next({ orderId: 7, message: message(2, 'hello') });

    expect(messageIds()).toEqual([1, 2]);
  });

  it('should add messages from the other party', () => {
    messageReceived$.next({ orderId: 7, message: message(3) });

    expect(messageIds()).toEqual([1, 3]);
  });

  it('should ignore messages for other orders', () => {
    messageReceived$.next({ orderId: 8, message: message(3) });

    expect(messageIds()).toEqual([1]);
  });

  it('reloads missed messages and closed status while preserving drafts', () => {
    component['newMessage'].set('draft');
    mockOrderService.getMessages.mockReturnValue(of([message(1), message(2)]));
    getOrder.mockReturnValue(of({ status: OrderStatus.Delivered }));
    restored$.next();
    expect(messageIds()).toEqual([1, 2]);
    expect(component['isClosed']()).toBe(true);
    expect(component['newMessage']()).toBe('draft');
  });

  it('preserves live messages and status received during a reload', () => {
    const history = new Subject<OrderMessage[]>();
    const order = new Subject<any>();
    mockOrderService.getMessages.mockReturnValue(history);
    getOrder.mockReturnValue(order);
    restored$.next();
    messageReceived$.next({ orderId: 7, message: message(3) });
    statusChanged$.next({ orderId: 7, newStatus: 'Delivered' });
    history.next([message(1), message(2), message(3)]);
    order.next({ status: OrderStatus.Pending });
    expect(messageIds()).toEqual([1, 2, 3]);
    expect(component['isClosed']()).toBe(true);
  });

  it('clears stale presence while reconnecting', () => {
    component['presence'].set({ orderId: 7, cookOnline: true, eaterOnline: true });
    state.set('reconnecting');
    fixture.detectChanges();
    expect(component['presence']()).toBeNull();
  });
});
