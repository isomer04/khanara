import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';

import { ToastService } from './toast-service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([])],
    });
    service = TestBed.inject(ToastService);
  });

  afterEach(() => {
    document.getElementById('toast-container')?.remove();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should not interpret HTML in the message (XSS protection)', () => {
    service.error('<img src=x onerror="window.__pwned=true">');

    const container = document.getElementById('toast-container');
    const toast = container?.querySelector('.alert');

    // The message must be rendered as text, not parsed into DOM nodes.
    expect(toast?.querySelector('img')).toBeNull();
    expect(toast?.textContent).toContain('<img src=x onerror="window.__pwned=true">');
    expect((window as unknown as Record<string, unknown>)['__pwned']).toBeUndefined();
  });

  it('should sanitize a dangerous image URL', () => {
    service.success('hi', 5000, 'javascript:alert(1)');

    const img = document
      .getElementById('toast-container')
      ?.querySelector('img');

    // javascript: URLs are stripped by the URL sanitizer and replaced with
    // the default image (or at minimum not left as an executable scheme).
    expect(img?.getAttribute('src')?.startsWith('javascript:')).toBe(false);
  });

  it('should render the image when a safe URL is provided', () => {
    service.info('hello', 5000, 'https://example.com/photo.jpg');

    const img = document
      .getElementById('toast-container')
      ?.querySelector('img');

    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe('https://example.com/photo.jpg');
  });

  it('should remove the toast but not navigate when close button is clicked', () => {
    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigateByUrl');

    service.success('Order placed!', 5000, undefined, '/orders/1');

    const container = document.getElementById('toast-container');
    const toast = container?.querySelector('.alert') ?? null;
    const closeButton = toast?.querySelector<HTMLButtonElement>('[aria-label="Close notification"]');

    expect(closeButton).not.toBeNull();
    closeButton!.click();

    expect(container?.contains(toast)).toBe(false);
    expect(navSpy).not.toHaveBeenCalled();
  });
});
