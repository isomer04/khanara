import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { vi } from 'vitest';
import { authGuard } from './auth-guard';
import { AccountService } from '../services/account-service';
import { ToastService } from '../services/toast-service';

const fakeRoute = {} as ActivatedRouteSnapshot;
const fakeState = {} as RouterStateSnapshot;

describe('authGuard', () => {
  let currentUserSpy: ReturnType<typeof vi.fn>;
  let mockToast: { error: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    currentUserSpy = vi.fn().mockReturnValue(null);
    mockToast = { error: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
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

  it('returns false when no user is logged in', () => {
    expect(run()).toBe(false);
  });

  it('shows an error toast when access is denied', () => {
    run();
    expect(mockToast.error).toHaveBeenCalledWith('You shall not pass');
  });

  it('does not show a toast when user is authenticated', () => {
    currentUserSpy.mockReturnValue({ id: 'u1' });
    run();
    expect(mockToast.error).not.toHaveBeenCalled();
  });
});
