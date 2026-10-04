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

  beforeEach(async () => {
    messageReceived$ = new Subject();
    mockOrderService = {
      getMessages: vi.fn().mockReturnValue(of([message(1)])),
      sendMessage: vi.fn().mockReturnValue(of(message(2, 'hello'))),
    };

    await TestBed.configureTestingModule({
      imports: [OrderChat],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '7' }) } } },
        { provide: OrderService, useValue: mockOrderService },
        { provide: AccountService, useValue: { currentUser: signal({ id: 'u1' }) } },
        { provide: ToastService, useValue: createMockToastService() },
        {
          provide: OrderHubService,
          useValue: {
            connect: vi.fn(),
            disconnect: vi.fn(),
            joinOrder: vi.fn().mockResolvedValue(undefined),
            leaveOrder: vi.fn().mockResolvedValue(undefined),
            messageReceived$,
            presenceChanged$: new Subject(),
            statusChanged$: new Subject(),
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
});
