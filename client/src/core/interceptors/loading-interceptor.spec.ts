import { TestBed } from '@angular/core/testing';
import { HttpInterceptorFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { vi } from 'vitest';
import { of } from 'rxjs';

import { loadingInterceptor } from './loading-interceptor';
import { BusyService } from '../services/busy-service';

describe('loadingInterceptor', () => {
  const interceptor: HttpInterceptorFn = (req, next) =>
    TestBed.runInInjectionContext(() => loadingInterceptor(req, next));

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should be created', () => {
    expect(interceptor).toBeTruthy();
  });

  it('forwards every GET to the network', () => {
    const req = new HttpRequest('GET', '/api/dishes');
    const next = vi.fn().mockReturnValue(of(new HttpResponse({ status: 200, body: [] })));

    interceptor(req, next).subscribe();
    interceptor(req, next).subscribe();

    expect(next).toHaveBeenCalledTimes(2);
  });

  it('increments the busy count while a request is in flight', () => {
    const busyService = TestBed.inject(BusyService);
    const req = new HttpRequest('GET', '/api/dishes');
    let countDuringRequest = 0;
    const next = vi.fn().mockImplementation(() => {
      countDuringRequest = busyService.busyRequestCount();
      return of(new HttpResponse({ status: 200 }));
    });

    interceptor(req, next).subscribe();

    expect(countDuringRequest).toBe(1);
  });
});
