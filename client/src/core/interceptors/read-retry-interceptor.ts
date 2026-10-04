import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { defer, retry, throwError, timer } from 'rxjs';
import { environment } from '../../environments/environment';

// Replay reads only: even token refresh rotates durable credentials.
export const readRetryInterceptor: HttpInterceptorFn = (req, next) => {
  const api = new URL(environment.apiUrl, document.baseURI);
  const url = new URL(req.url, document.baseURI);
  if (req.method !== 'GET' || url.origin !== api.origin || !url.pathname.startsWith(api.pathname)) {
    return next(req);
  }
  return defer(() => next(req)).pipe(
    retry({
      count: 2,
      delay: (error: unknown, attempt) =>
        error instanceof HttpErrorResponse && [0, 502, 503, 504].includes(error.status)
          ? timer(attempt === 1 ? 1000 : 3000)
          : throwError(() => error),
    }),
  );
};
