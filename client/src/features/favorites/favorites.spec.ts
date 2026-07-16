import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { Favorites } from './favorites';
import { FavoritesService } from '../../core/services/favorites-service';
import { buildPaginatedResult } from '../../testing/test-data-builders';
import { FavoriteDto } from '../../types/favorite';
import { createMockFavoritesService } from '../../testing/mock-services';

describe('Favorites', () => {
  let component: Favorites;
  let fixture: ComponentFixture<Favorites>;
  let mockFavoritesService: ReturnType<typeof createMockFavoritesService>;

  beforeEach(async () => {
    mockFavoritesService = createMockFavoritesService({
      getFavorites: vi.fn().mockReturnValue(of(buildPaginatedResult([], 1, 10))),
    });

    await TestBed.configureTestingModule({
      imports: [Favorites],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: FavoritesService, useValue: mockFavoritesService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Favorites);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('initialization', () => {
    it('should load favorites on init', () => {
      const mockFavorites: FavoriteDto[] = [
        { cookProfileId: 1, kitchenName: 'Chef Alice Kitchen', kitchenPhotoUrl: 'photo1.jpg', averageRating: 4.5, reviewCount: 10, isAcceptingOrders: true, favoritedAt: '2024-01-01' },
        { cookProfileId: 2, kitchenName: 'Chef Bob Kitchen', kitchenPhotoUrl: 'photo2.jpg', averageRating: 4.8, reviewCount: 15, isAcceptingOrders: true, favoritedAt: '2024-01-02' },
      ];
      mockFavoritesService.getFavorites.mockReturnValue(
        of(buildPaginatedResult(mockFavorites, 1, 10))
      );

      fixture.detectChanges();

      expect(mockFavoritesService.getFavorites).toHaveBeenCalledWith(1, 10);
      expect(component.favorites()).toEqual(mockFavorites);
    });

    it('should set loading state during favorites loading', () => {
      fixture.detectChanges();

      expect(component.loading()).toBe(false);
    });

    it('should set pagination metadata', () => {
      const mockFavorites: FavoriteDto[] = [
        { cookProfileId: 1, kitchenName: 'Chef Alice Kitchen', kitchenPhotoUrl: null, averageRating: 4.5, reviewCount: 10, isAcceptingOrders: true, favoritedAt: '2024-01-01' },
      ];
      const paginatedResult = buildPaginatedResult(mockFavorites, 1, 10);
      mockFavoritesService.getFavorites.mockReturnValue(of(paginatedResult));

      fixture.detectChanges();

      expect(component.pagination()).toEqual(paginatedResult.metadata);
    });
  });

  describe('listing', () => {
    it('should display favorites list when favorites are loaded', () => {
      const mockFavorites: FavoriteDto[] = [
        { cookProfileId: 1, kitchenName: 'Alice Kitchen', kitchenPhotoUrl: 'photo1.jpg', averageRating: 4.5, reviewCount: 10, isAcceptingOrders: true, favoritedAt: '2024-01-01' },
        { cookProfileId: 2, kitchenName: 'Bob Kitchen', kitchenPhotoUrl: 'photo2.jpg', averageRating: 4.8, reviewCount: 15, isAcceptingOrders: true, favoritedAt: '2024-01-02' },
      ];
      mockFavoritesService.getFavorites.mockReturnValue(
        of(buildPaginatedResult(mockFavorites, 1, 10))
      );

      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Alice Kitchen');
      expect(compiled.textContent).toContain('Bob Kitchen');
    });

    it('should return photo URL when available', () => {
      const favorite: FavoriteDto = {
        cookProfileId: 1,
        kitchenName: 'Chef Alice Kitchen',
        kitchenPhotoUrl: 'https://example.com/kitchen.jpg',
        averageRating: 4.5,
        reviewCount: 10,
        isAcceptingOrders: true,
        favoritedAt: '2024-01-01'
      };

      const photoUrl = component.getPhoto(favorite);

      expect(photoUrl).toBe('https://example.com/kitchen.jpg');
    });

    it('should return placeholder when no photo available', () => {
      const favorite: FavoriteDto = {
        cookProfileId: 1,
        kitchenName: 'Chef Alice Kitchen',
        kitchenPhotoUrl: null,
        averageRating: 4.5,
        reviewCount: 10,
        isAcceptingOrders: true,
        favoritedAt: '2024-01-01'
      };

      const photoUrl = component.getPhoto(favorite);

      // ngSrcFor resolves placeholder against window.location.origin for NgOptimizedImage
      expect(photoUrl).toContain('kitchen-placeholder.png');
    });
  });

  describe('pagination', () => {
    it('should load next page when page changes', () => {
      fixture.detectChanges();
      vi.mocked(mockFavoritesService.getFavorites).mockClear();

      component.onPageChange({ pageNumber: 2, pageSize: 10 });

      expect(component.pageNumber()).toBe(2);
      expect(mockFavoritesService.getFavorites).toHaveBeenCalledWith(2, 10);
    });

    it('should update page size when changed', () => {
      fixture.detectChanges();
      vi.mocked(mockFavoritesService.getFavorites).mockClear();

      component.onPageChange({ pageNumber: 1, pageSize: 20 });

      expect(component.pageSize).toBe(20);
      expect(mockFavoritesService.getFavorites).toHaveBeenCalledWith(1, 20);
    });
  });

  describe('empty state', () => {
    it('should handle empty favorites list', () => {
      mockFavoritesService.getFavorites.mockReturnValue(of(buildPaginatedResult([], 1, 10)));

      fixture.detectChanges();

      expect(component.favorites()).toEqual([]);
      expect(component.favorites().length).toBe(0);
    });
  });

  describe('removal', () => {
    it('should reload favorites after favorite is removed', () => {
      const mockFavorites: FavoriteDto[] = [
        { cookProfileId: 1, kitchenName: 'Chef Alice Kitchen', kitchenPhotoUrl: null, averageRating: 4.5, reviewCount: 10, isAcceptingOrders: true, favoritedAt: '2024-01-01' },
      ];
      mockFavoritesService.getFavorites.mockReturnValue(
        of(buildPaginatedResult(mockFavorites, 1, 10))
      );
      fixture.detectChanges();

      // Simulate favorite removal by reloading
      mockFavoritesService.getFavorites.mockReturnValue(of(buildPaginatedResult([], 1, 10)));
      component.loadFavorites();
      fixture.detectChanges();

      expect(component.favorites()).toEqual([]);
    });
  });
});
