import { HttpErrorResponse, HttpRequest, HttpResponse } from '@angular/common/http';
import { defer, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { readRetryInterceptor } from './read-retry-interceptor';
import { TestBed } from '@angular/core/testing';
import { loadingInterceptor } from './loading-interceptor';
import { BusyService } from '../services/busy-service';

describe('readRetryInterceptor', () => {
  afterEach(() => vi.useRealTimers());

  it('recovers a safe read after the two bounded delays', async () => {
    vi.useFakeTimers();
    const next = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 503 })))
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 0 })))
      .mockReturnValue(of(new HttpResponse({ status: 200 })));
    const received = vi.fn();
    readRetryInterceptor(new HttpRequest('GET', '/api/orders/7'), next).subscribe(received);
    await vi.advanceTimersByTimeAsync(999);
    expect(next).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(next).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(3000);
    expect(next).toHaveBeenCalledTimes(3);
    expect(received).toHaveBeenCalledTimes(1);
  });

  it('reports a final failure once and stops after three attempts', async () => {
    vi.useFakeTimers();
    const next = vi.fn(() => defer(() => throwError(() => new HttpErrorResponse({ status: 504 }))));
    const failed = vi.fn();
    readRetryInterceptor(new HttpRequest('GET', '/api/orders/7'), next).subscribe({
      error: failed,
    });
    await vi.advanceTimersByTimeAsync(10000);
    expect(next).toHaveBeenCalledTimes(3);
    expect(failed).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['POST', '/api/orders', 503],
    ['PUT', '/api/orders/7', 503],
    ['DELETE', '/api/orders/7', 503],
    ['POST', '/api/account/refresh-token', 503],
    ['GET', '/api/orders', 401],
    ['GET', '/api/orders', 429],
    ['GET', '/api/orders', 500],
    ['GET', '/api/orders', 404],
    ['GET', 'https://example.com/api/orders', 503],
    ['GET', '/assets/image.png', 503],
  ])('does not retry %s %s with status %s', async (method, url, status) => {
    vi.useFakeTimers();
    const next = vi.fn(() => throwError(() => new HttpErrorResponse({ status })));
    readRetryInterceptor(new HttpRequest(method, url, null), next).subscribe({ error: () => {} });
    await vi.advanceTimersByTimeAsync(10000);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('cancels retries when the subscriber leaves', async () => {
    vi.useFakeTimers();
    const next = vi.fn(() => throwError(() => new HttpErrorResponse({ status: 502 })));
    const subscription = readRetryInterceptor(
      new HttpRequest('GET', '/api/orders'),
      next,
    ).subscribe();
    subscription.unsubscribe();
    await vi.advanceTimersByTimeAsync(10000);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('keeps a single loading count active throughout all attempts', async () => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({});
    const busy = TestBed.inject(BusyService);
    const next = vi.fn(() => throwError(() => new HttpErrorResponse({ status: 503 })));
    TestBed.runInInjectionContext(() =>
      loadingInterceptor(new HttpRequest('GET', '/api/orders'), (req) =>
        readRetryInterceptor(req, next),
      ),
    ).subscribe({ error: () => {} });
    expect(busy.busyRequestCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(busy.busyRequestCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(3000);
    expect(busy.busyRequestCount()).toBe(0);
  });
});
