import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AccountService } from '../services/account-service';

export const noCookProfileGuard: CanActivateFn = () => {
  const accountService = inject(AccountService);
  const router = inject(Router);

  if (accountService.currentUser()?.roles.includes('Cook')) {
    return router.createUrlTree(['/cook/dashboard']);
  }

  return true;
};
