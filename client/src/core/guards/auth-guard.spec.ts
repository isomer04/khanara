import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { vi } from 'vitest';
import { authGuard } from './auth-guard';
import { AccountService } from '../services/account-service';
import { ToastService } from '../services/toast-service';

const fakeRoute = {} as ActivatedRouteSnapshot;
const fakeState = { url: '/orders/7' } as RouterStateSnapshot;

describe('authGuard', () => {
  let currentUserSpy: ReturnType<typeof vi.fn>;
  let mockToast: { error: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    currentUserSpy = vi.fn().mockReturnValue(null);
    mockToast = { error: vi.fn(), info: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AccountService, useValue: { currentUser: currentUserSpy } },
        { provide: ToastService, useValue: mockToast },
      ],
    });
  });

  const run = () =>
    TestBed.runInInjectionContext(() => authGuard(fakeRoute, fakeState));

  it('returns true when a user is logged in', () => {
    currentUserSpy.mockReturnValue({ id: 'u1', displayName: 'Test' });
    expect(run()).toBe(true);
  });

  it('redirects to the login prompt with a return URL when no user is logged in', () => {
    const result = run();
    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree))
      .toBe('/?login=1&returnUrl=%2Forders%2F7');
  });

  it('tells the user to log in when access is denied', () => {
    run();
    expect(mockToast.info).toHaveBeenCalledWith('Please log in to continue');
  });

  it('does not show a toast when user is authenticated', () => {
    currentUserSpy.mockReturnValue({ id: 'u1' });
    run();
    expect(mockToast.info).not.toHaveBeenCalled();
  });
});
