import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Router } from '@angular/router';
import { vi } from 'vitest';
import { errorInterceptor } from './error-interceptor';
import { ToastService } from '../services/toast-service';

describe('errorInterceptor', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;
  let mockToast: { error: ReturnType<typeof vi.fn> };
  let router: Router;

  beforeEach(() => {
    mockToast = { error: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ToastService, useValue: mockToast },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => httpTesting.verify());

  const get = (url = '/api/test') =>
    http.get(url).subscribe({ error: () => {} });

  it('passes through on a successful response without side effects', () => {
    get();
    httpTesting.expectOne('/api/test').flush({ ok: true });
    expect(mockToast.error).not.toHaveBeenCalled();
  });

  it('shows Unauthorized toast on 401', () => {
    get();
    httpTesting
      .expectOne('/api/test')
      .flush(null, { status: 401, statusText: 'Unauthorized' });
    expect(mockToast.error).toHaveBeenCalledWith('Unauthorized');
  });

  it('does not show Unauthorized toast on 401 for /favorites/ids endpoint', () => {
    get('/api/favorites/ids');
    httpTesting
      .expectOne('/api/favorites/ids')
      .flush(null, { status: 401, statusText: 'Unauthorized' });
    expect(mockToast.error).not.toHaveBeenCalled();
  });

  it('does not show Unauthorized toast on 401 for /account/refresh-token endpoint', () => {
    get('/api/account/refresh-token');
    httpTesting
      .expectOne('/api/account/refresh-token')
      .flush(null, { status: 401, statusText: 'Unauthorized' });
    expect(mockToast.error).not.toHaveBeenCalled();
  });

  it('navigates to /not-found on 404', () => {
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    get();
    httpTesting
      .expectOne('/api/test')
      .flush(null, { status: 404, statusText: 'Not Found' });
    expect(router.navigateByUrl).toHaveBeenCalledWith('/not-found');
  });

  it('navigates to /server-error with error state on 500', () => {
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    get();
    const body = { message: 'Something broke', details: 'stack' };
    httpTesting
      .expectOne('/api/test')
      .flush(body, { status: 500, statusText: 'Server Error' });
    expect(router.navigateByUrl).toHaveBeenCalledWith(
      '/server-error',
      expect.objectContaining({ state: { error: body } })
    );
  });

  it('shows body message as toast on 400 without model-state errors', () => {
    get();
    httpTesting
      .expectOne('/api/test')
      .flush('Email already taken', { status: 400, statusText: 'Bad Request' });
    expect(mockToast.error).toHaveBeenCalledWith('Email already taken');
  });

  it('throws flat validation error array on 400 with model-state errors', () => {
    let caught: any;
    http.get('/api/test').subscribe({ error: e => (caught = e) });
    httpTesting.expectOne('/api/test').flush(
      {
        errors: {
          Password: ['Too short', 'Needs a digit'],
          Email: ['Invalid format'],
        },
      },
      { status: 400, statusText: 'Bad Request' }
    );
    expect(caught).toContain('Too short');
    expect(caught).toContain('Needs a digit');
    expect(caught).toContain('Invalid format');
  });

  it('shows generic toast for unhandled status codes', () => {
    get();
    httpTesting
      .expectOne('/api/test')
      .flush(null, { status: 503, statusText: 'Service Unavailable' });
    expect(mockToast.error).toHaveBeenCalledWith('Something unexpected went wrong');
  });
});
