import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { FavoritesService } from './favorites-service';
import { environment } from '../../environments/environment';

describe('FavoritesService', () => {
  let service: FavoritesService;
  let http: HttpTestingController;
  const base = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(FavoritesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('favoriteIds signal starts empty', () => {
    expect(service.favoriteIds().size).toBe(0);
  });

  it('isFavorited returns false for unknown cook', () => {
    expect(service.isFavorited(99)).toBe(false);
  });

  it('addFavorite optimistically adds cook to favoriteIds', () => {
    service.addFavorite(5).subscribe();
    expect(service.isFavorited(5)).toBe(true);
    http.expectOne(base + 'favorites/5').flush({});
  });

  it('addFavorite rolls back on HTTP error', () => {
    service.addFavorite(5).subscribe({ error: () => {} });
    http.expectOne(base + 'favorites/5').flush('error', { status: 400, statusText: 'Bad Request' });
    expect(service.isFavorited(5)).toBe(false);
  });

  it('removeFavorite optimistically removes cook from favoriteIds', () => {
    service.addFavorite(5).subscribe();
    http.expectOne(base + 'favorites/5').flush({});

    service.removeFavorite(5).subscribe();
    expect(service.isFavorited(5)).toBe(false);
    http.expectOne(base + 'favorites/5').flush(null);
  });

  it('loadFavoriteIds hydrates favoriteIds signal', () => {
    service.loadFavoriteIds().subscribe();
    http.expectOne(base + 'favorites/ids').flush([1, 2, 3]);
    expect(service.isFavorited(1)).toBe(true);
    expect(service.isFavorited(4)).toBe(false);
  });

  it('clearFavoriteIds empties signal', () => {
    service.loadFavoriteIds().subscribe();
    http.expectOne(base + 'favorites/ids').flush([1, 2]);
    service.clearFavoriteIds();
    expect(service.favoriteIds().size).toBe(0);
  });
});
