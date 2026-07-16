import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { DiscoveryCookDto } from '../../types/favorite';

@Injectable({ providedIn: 'root' })
export class DiscoveryService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiUrl;

  getNearMe(zip: string) {
    const params = new HttpParams().set('zip', zip);
    return this.http.get<DiscoveryCookDto[]>(this.baseUrl + 'discovery/near-me', { params });
  }

  getPopular() {
    return this.http.get<DiscoveryCookDto[]>(this.baseUrl + 'discovery/popular');
  }

  getNew() {
    return this.http.get<DiscoveryCookDto[]>(this.baseUrl + 'discovery/new');
  }
}
