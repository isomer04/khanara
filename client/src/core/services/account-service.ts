import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { LoginCreds, RegisterCreds, User } from '../../types/user';
import { tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { FavoritesService } from './favorites-service';

@Injectable({
  providedIn: 'root',
})
export class AccountService {
  private http = inject(HttpClient);
  private favoritesService = inject(FavoritesService);
  currentUser = signal<User | null>(null);
  private baseUrl = environment.apiUrl;
  private refreshIntervalId?: ReturnType<typeof setInterval>;

  register(creds: RegisterCreds) {
    return this.http
      .post<User>(this.baseUrl + 'account/register', creds, { withCredentials: true })
      .pipe(tap((user) => { if (user) this.setCurrentUser(user); }));
  }

  login(creds: LoginCreds) {
    return this.http
      .post<User>(this.baseUrl + 'account/login', creds, { withCredentials: true })
      .pipe(tap((user) => { if (user) this.setCurrentUser(user); }));
  }

  refreshToken() {
    return this.http.post<User>(
      this.baseUrl + 'account/refresh-token',
      {},
      { withCredentials: true },
    );
  }

  startTokenRefreshInterval() {
    clearInterval(this.refreshIntervalId);
    this.refreshIntervalId = setInterval(
      () => {
        this.http
          .post<User>(this.baseUrl + 'account/refresh-token', {}, { withCredentials: true })
          .subscribe({
            next: (user) => {
              this.setCurrentUser(user);
            },
            error: () => {
              this.logout();
            },
          });
      },
      5 * 60 * 1000,
    );
  }

  setCurrentUser(user: User) {
    user.roles = this.getRolesFromToken(user);
    this.currentUser.set(user);
    this.startTokenRefreshInterval();
    this.favoritesService.loadFavoriteIds().subscribe({ error: () => { } });
  }

  logout() {
    this.http.post(this.baseUrl + 'account/logout', {}, { withCredentials: true }).subscribe({
      next: () => {
        localStorage.removeItem('filters');
        this.favoritesService.clearFavoriteIds();
        this.currentUser.set(null);
        clearInterval(this.refreshIntervalId);
      },
    });
  }

  private getRolesFromToken(user: User): string[] {
    try {
      const jsonPayload = JSON.parse(atob(user.token.split('.')[1]));
      if (!jsonPayload?.role) return [];
      return Array.isArray(jsonPayload.role) ? jsonPayload.role : [jsonPayload.role];
    } catch {
      return [];
    }
  }
}
