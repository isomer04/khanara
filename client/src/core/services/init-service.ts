import { inject, Injectable } from '@angular/core';
import { AccountService } from './account-service';
import { catchError, Observable, of, tap } from 'rxjs';
import { User } from '../../types/user';

@Injectable({
  providedIn: 'root'
})
export class InitService {
  private accountService = inject(AccountService);

  init(): Observable<User | null> {
    return this.accountService.refreshToken().pipe(
      tap(user => {
        if (user) {
          this.accountService.setCurrentUser(user);
          this.accountService.startTokenRefreshInterval();
        }
      }),
      catchError(() => {
        // No valid session to restore - user is not logged in, which is fine
        return of(null);
      })
    )
  }
}
