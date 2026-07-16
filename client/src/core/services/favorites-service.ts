import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { catchError, tap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { FavoriteDto } from '../../types/favorite';
import { PaginatedResult } from '../../types/pagination';

@Injectable({ providedIn: 'root' })
export class FavoritesService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiUrl;

  favoriteIds = signal<Set<number>>(new Set());
  // Once any toggle fires, hydration must not overwrite the user's live state.
  private isHydrated = false;

  loadFavoriteIds() {
    return this.http.get<number[]>(this.baseUrl + 'favorites/ids').pipe(
      tap(ids => {
        if (!this.isHydrated) {
          this.favoriteIds.set(new Set(ids));
          this.isHydrated = true;
        }
      })
    );
  }

  isFavorited(cookProfileId: number): boolean {
    return this.favoriteIds().has(cookProfileId);
  }

  addFavorite(cookId: number) {
    this.isHydrated = true;
    this.favoriteIds.update(ids => new Set([...ids, cookId]));
    return this.http.post(`${this.baseUrl}favorites/${cookId}`, {}).pipe(
      catchError(err => {
        this.favoriteIds.update(ids => { const next = new Set(ids); next.delete(cookId); return next; });
        return throwError(() => err);
      })
    );
  }

  removeFavorite(cookId: number) {
    this.isHydrated = true;
    this.favoriteIds.update(ids => { const next = new Set(ids); next.delete(cookId); return next; });
    return this.http.delete(`${this.baseUrl}favorites/${cookId}`).pipe(
      catchError(err => {
        this.favoriteIds.update(ids => new Set([...ids, cookId]));
        return throwError(() => err);
      })
    );
  }

  getFavorites(pageNumber = 1, pageSize = 10) {
    const params = new HttpParams()
      .set('pageNumber', pageNumber)
      .set('pageSize', pageSize);
    return this.http.get<PaginatedResult<FavoriteDto>>(this.baseUrl + 'favorites', { params });
  }

  clearFavoriteIds() {
    this.isHydrated = false;
    this.favoriteIds.set(new Set());
  }
}
