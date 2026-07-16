import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { environment } from '../../environments/environment';
import { CookProfile, CreateCookProfileDto, UpdateCookProfileDto } from '../../types/cook-profile';
import { PaginatedResult } from '../../types/pagination';
import { tap } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class CookService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiUrl;

  myCookProfile = signal<CookProfile | null>(null);

  getCooks(pageNumber = 1, pageSize = 12, cuisine?: number, zip?: string) {
    let params = new HttpParams()
      .set('pageNumber', pageNumber)
      .set('pageSize', pageSize);
    if (cuisine !== undefined) params = params.set('cuisine', cuisine);
    if (zip) params = params.set('zip', zip);

    return this.http.get<PaginatedResult<CookProfile>>(this.baseUrl + 'cooks', { params });
  }

  getCook(id: number) {
    return this.http.get<CookProfile>(this.baseUrl + `cooks/${id}`);
  }

  createCookProfile(dto: CreateCookProfileDto) {
    return this.http.post<CookProfile>(this.baseUrl + 'cooks', dto).pipe(
      tap(profile => this.myCookProfile.set(profile))
    );
  }

  updateCookProfile(dto: UpdateCookProfileDto) {
    return this.http.put<CookProfile>(this.baseUrl + 'cooks/me', dto).pipe(
      tap(profile => this.myCookProfile.set(profile))
    );
  }

  loadMyCookProfile() {
    return this.http.get<CookProfile>(this.baseUrl + 'cooks/me').pipe(
      tap(profile => this.myCookProfile.set(profile))
    );
  }
}
