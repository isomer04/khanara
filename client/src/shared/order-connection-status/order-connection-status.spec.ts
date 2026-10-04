import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { OrderConnectionState, OrderHubService } from '../../core/services/order-hub-service';
import { OrderConnectionStatus } from './order-connection-status';

describe('OrderConnectionStatus', () => {
  let fixture: ComponentFixture<OrderConnectionStatus>;
  let state: ReturnType<typeof signal<OrderConnectionState>>;
  let retry: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    state = signal<OrderConnectionState>('disconnected');
    retry = vi.fn();
    await TestBed.configureTestingModule({
      imports: [OrderConnectionStatus],
      providers: [{ provide: OrderHubService, useValue: { connectionState: state, retry } }],
    }).compileComponents();
    fixture = TestBed.createComponent(OrderConnectionStatus);
    fixture.detectChanges();
  });

  it.each<OrderConnectionState>(['connected', 'paused', 'disconnected'])(
    'shows no status panel or retry action while %s',
    (connectionState) => {
      state.set(connectionState);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[role="status"]')).toBeNull();
      expect(fixture.nativeElement.querySelector('button')).toBeNull();
      expect(retry).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['connecting', 'Connecting…'],
    ['reconnecting', 'Reconnecting…'],
  ] as const)('announces %s without offering a duplicate retry', (connectionState, label) => {
    state.set(connectionState);
    fixture.detectChanges();
    const status = fixture.nativeElement.querySelector('[role="status"]') as HTMLElement;
    expect(status.textContent?.trim()).toBe(label);
    expect(status.getAttribute('aria-atomic')).toBe('true');
    expect(status.querySelector('[aria-hidden="true"]')).not.toBeNull();
    expect(status.querySelector('button')).toBeNull();
  });

  it('offers a non-submit retry button only after failure', () => {
    state.set('failed');
    fixture.detectChanges();
    const status = fixture.nativeElement.querySelector('[role="status"]') as HTMLElement;
    expect(status.textContent).toContain('Live updates are unavailable.');
    const button = status.querySelector('button') as HTMLButtonElement;
    expect(button.textContent?.trim()).toBe('Retry connection');
    expect(button.type).toBe('button');
    expect(retry).not.toHaveBeenCalled();
    button.click();
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('updates the panel as recovery proceeds and removes it once connected', () => {
    state.set('failed');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button')).not.toBeNull();
    state.set('reconnecting');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Reconnecting…');
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
    state.set('connected');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeNull();
    expect(retry).not.toHaveBeenCalled();
  });
});
