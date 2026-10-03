import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AccountService } from '../services/account-service';
import { ToastService } from '../services/toast-service';

export const authGuard: CanActivateFn = (_route, state) => {
  const accountService = inject(AccountService);
  const toast = inject(ToastService);
  const router = inject(Router);

  if (accountService.currentUser()) return true;

  // Nav opens the login modal for ?login=1 and returns to returnUrl afterwards
  toast.info('Please log in to continue');
  return router.createUrlTree(['/'], { queryParams: { login: 1, returnUrl: state.url } });
};
