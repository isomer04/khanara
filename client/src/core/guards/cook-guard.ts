import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AccountService } from '../services/account-service';
import { ToastService } from '../services/toast-service';

export const cookGuard: CanActivateFn = () => {
  const accountService = inject(AccountService);
  const toast = inject(ToastService);
  const router = inject(Router);

  if (!accountService.currentUser()) {
    toast.error('Please log in first');
    return false;
  }

  if (accountService.currentUser()?.roles.includes('Cook')) {
    return true;
  }

  toast.error('You need a cook profile to access this area');
  return router.createUrlTree(['/cook/onboarding']);
};
