import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { CookOnboarding } from './cook-onboarding';
import { CookService } from '../../../core/services/cook-service';
import { AccountService } from '../../../core/services/account-service';
import { ToastService } from '../../../core/services/toast-service';
import { CuisineTag } from '../../../types/cook-profile';

describe('CookOnboarding', () => {
  let component: CookOnboarding;
  let fixture: ComponentFixture<CookOnboarding>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CookOnboarding],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CookOnboarding);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('when the token refresh fails after the profile is created', () => {
    let createCookProfile: ReturnType<typeof vi.fn>;
    let accountService: AccountService;
    let toast: ToastService;
    let router: Router;

    beforeEach(() => {
      createCookProfile = vi.fn().mockReturnValue(of({}));
      (TestBed.inject(CookService) as any).createCookProfile = createCookProfile;
      accountService = TestBed.inject(AccountService);
      vi.spyOn(accountService, 'refreshToken').mockReturnValue(throwError(() => ({ status: 401 })));
      vi.spyOn(accountService, 'logout').mockImplementation(() => {});
      toast = TestBed.inject(ToastService);
      vi.spyOn(toast, 'warning');
      vi.spyOn(toast, 'error');
      router = TestBed.inject(Router);
      vi.spyOn(router, 'navigate').mockResolvedValue(true);

      component['form'].kitchenName = 'My Kitchen';
      component['form'].selectedCuisineTags = [CuisineTag.Bengali];
      component.submit();
    });

    it('asks the user to log in again without resubmitting the profile', () => {
      expect(createCookProfile).toHaveBeenCalledTimes(1);
      expect(toast.warning).toHaveBeenCalledWith(
        'Your kitchen was created. Please log in again to open your dashboard.');
      expect(toast.error).not.toHaveBeenCalled();
      expect(accountService.logout).toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/'], { queryParams: { login: 1, returnUrl: '/cook/dashboard' } });
    });

    it('clears the loading state', () => {
      expect(component['loading']()).toBe(false);
    });
  });
});
