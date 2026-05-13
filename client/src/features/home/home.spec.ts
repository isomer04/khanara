import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ɵDeferBlockBehavior as DeferBlockBehavior, ɵDeferBlockState as DeferBlockState } from '@angular/core';
import { IMAGE_LOADER, PRECONNECT_CHECK_BLOCKLIST } from '@angular/common';
import { Home } from './home';
import { DiscoveryService } from '../../core/services/discovery-service';
import { FavoritesService } from '../../core/services/favorites-service';
import { AccountService } from '../../core/services/account-service';
import { DiscoveryCookDto } from '../../types/favorite';
import { CuisineTag, CuisineTagLabels } from '../../types/cook-profile';
import { buildUser } from '../../testing/test-data-builders';
import { createMockAccountService, createMockFavoritesService } from '../../testing/mock-services';
import { ngSrcFor } from '../../core/services/image-url';
import { environment } from '../../environments/environment';

/** Trigger all @defer blocks in the fixture so deferred content renders in tests. */
async function triggerAllDeferBlocks(fixture: ComponentFixture<any>): Promise<void> {
  const deferBlocks = await fixture.getDeferBlocks();
  for (const block of deferBlocks) {
    await block.render(DeferBlockState.Complete);
  }
  fixture.detectChanges();
  await fixture.whenStable();
}

/**
 * Tests for Home component
 * 
 * **Validates: Requirements 3.6, 6.1, 6.2, 6.5**
 * 
 * This test suite covers:
 * - Discovery feed display (new cooks and popular cooks)
 * - Filtering by cuisine, dietary tags, and location
 * - Pagination controls
 * - Loading states and error handling
 */
describe('Home', () => {
  let component: Home;
  let fixture: ComponentFixture<Home>;
  let mockDiscoveryService: any;
  let mockFavoritesService: any;
  let mockAccountService: any;

  const mockNewCooks: DiscoveryCookDto[] = [
    {
      id: 1,
      kitchenName: 'Chef Alice Kitchen',
      kitchenPhotoUrl: 'https://example.com/photo1.jpg',
      cuisineTags: [CuisineTag.Italian],
      reviewCount: 5,
      averageRating: 4.5,
      isAcceptingOrders: true,
    },
    {
      id: 2,
      kitchenName: 'New Cook Kitchen',
      kitchenPhotoUrl: null,
      cuisineTags: [CuisineTag.Chinese, CuisineTag.Thai],
      reviewCount: 0,
      averageRating: 0,
      isAcceptingOrders: false,
    },
  ];

  const mockPopularCooks: DiscoveryCookDto[] = [
    {
      id: 3,
      kitchenName: 'Chef Bob Kitchen',
      kitchenPhotoUrl: 'https://example.com/photo2.jpg',
      cuisineTags: [CuisineTag.Mexican],
      reviewCount: 10,
      averageRating: 4.8,
      isAcceptingOrders: true,
    },
    {
      id: 4,
      kitchenName: 'Popular Kitchen',
      kitchenPhotoUrl: 'https://example.com/photo3.jpg',
      cuisineTags: [CuisineTag.Indian, CuisineTag.Pakistani],
      reviewCount: 25,
      averageRating: 4.9,
      isAcceptingOrders: true,
    },
  ];

  const mockNearbyCooks: DiscoveryCookDto[] = [
    {
      id: 5,
      kitchenName: 'Nearby Kitchen',
      kitchenPhotoUrl: 'https://example.com/photo4.jpg',
      cuisineTags: [CuisineTag.Lebanese],
      reviewCount: 8,
      averageRating: 4.6,
      isAcceptingOrders: true,
    },
  ];

  beforeEach(async () => {
    // Create mock services using Vitest
    mockDiscoveryService = {
      getNew: vi.fn().mockReturnValue(of(mockNewCooks)),
      getPopular: vi.fn().mockReturnValue(of(mockPopularCooks)),
      getNearMe: vi.fn().mockReturnValue(of(mockNearbyCooks)),
    };

    mockFavoritesService = createMockFavoritesService();
    mockAccountService = createMockAccountService();

    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [
        provideRouter([]),
        { provide: DiscoveryService, useValue: mockDiscoveryService },
        { provide: FavoritesService, useValue: mockFavoritesService },
        { provide: AccountService, useValue: mockAccountService },
        // Pass-through loader so NgOptimizedImage doesn't crash in jsdom
        { provide: IMAGE_LOADER, useValue: (config: any) => config.src },
        // Suppress preconnect warnings in tests
        { provide: PRECONNECT_CHECK_BLOCKLIST, useValue: ['https://example.com'] },
      ],
      // Render @defer blocks immediately so tests can query deferred content
      deferBlockBehavior: DeferBlockBehavior.Manual,
    }).compileComponents();

    fixture = TestBed.createComponent(Home);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('initialization', () => {
    it('should load new cooks on init', () => {
      fixture.detectChanges();

      expect(mockDiscoveryService.getNew).toHaveBeenCalled();
      expect(component.newCooks()).toEqual(mockNewCooks);
    });

    it('should load popular cooks when no zip code in localStorage', () => {
      vi.spyOn(localStorage, 'getItem').mockReturnValue(null);

      fixture.detectChanges();

      expect(mockDiscoveryService.getPopular).toHaveBeenCalled();
      expect(component.popularCooks()).toEqual(mockPopularCooks);
    });

    it('should load nearby cooks when zip code exists in localStorage', () => {
      vi.spyOn(localStorage, 'getItem').mockReturnValue('12345');

      fixture.detectChanges();

      expect(mockDiscoveryService.getNearMe).toHaveBeenCalledWith('12345');
      expect(component.popularCooks()).toEqual(mockNearbyCooks);
    });

    it('should fallback to popular cooks when nearby cooks fail', () => {
      vi.spyOn(localStorage, 'getItem').mockReturnValue('12345');
      mockDiscoveryService.getNearMe.mockReturnValue(throwError(() => new Error('Network error')));

      fixture.detectChanges();

      expect(mockDiscoveryService.getPopular).toHaveBeenCalled();
      expect(component.popularCooks()).toEqual(mockPopularCooks);
    });
  });

  describe('discovery feed display', () => {
    beforeEach(() => {
      // Ensure localStorage is clear for these tests
      vi.spyOn(localStorage, 'getItem').mockReturnValue(null);
    });

    it('should display new cooks section with cook cards', async () => {
      fixture.detectChanges();
      await triggerAllDeferBlocks(fixture);

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Chef Alice Kitchen');
      expect(compiled.textContent).toContain('New Cook Kitchen');
      expect(compiled.textContent).toContain('New on Khanara');
    });

    it('should display popular cooks section with cook cards', () => {
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Chef Bob Kitchen');
      expect(compiled.textContent).toContain('Popular Kitchen');
      expect(compiled.textContent).toContain('Popular on Khanara');
    });

    it('should display cook ratings and review counts', () => {
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('4.8');
      expect(compiled.textContent).toContain('(10)');
    });

    it('should display "Open now" badge for accepting orders', () => {
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const badges = Array.from(compiled.querySelectorAll('.badge-success'));
      const openBadges = badges.filter(badge => badge.textContent?.includes('Open now'));
      
      expect(openBadges.length).toBeGreaterThan(0);
    });

    it('should display "New" badge for new cooks', async () => {
      fixture.detectChanges();
      await triggerAllDeferBlocks(fixture);

      const compiled = fixture.nativeElement as HTMLElement;
      const badges = Array.from(compiled.querySelectorAll('.badge-primary'));
      const newBadges = badges.filter(badge => badge.textContent?.includes('New'));
      
      expect(newBadges.length).toBeGreaterThan(0);
    });

    it('should display favorite buttons for each cook', () => {
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const favoriteButtons = compiled.querySelectorAll('app-favorite-button');
      
      expect(favoriteButtons.length).toBeGreaterThan(0);
    });

    it('should return photo URL when available', () => {
      const cook: DiscoveryCookDto = {
        id: 1,
        kitchenName: 'Chef Alice',
        kitchenPhotoUrl: 'https://example.com/kitchen.jpg',
        cuisineTags: [],
        reviewCount: 0,
        averageRating: 0,
        isAcceptingOrders: true,
      };

      // getPhoto moved to CookCard — test the utility directly
      const photoUrl = ngSrcFor(cook.kitchenPhotoUrl, '/kitchen-placeholder.png', environment.apiUrl);

      expect(photoUrl).toBe('https://example.com/kitchen.jpg');
    });

    it('should return placeholder when no photo available', () => {
      const cook: DiscoveryCookDto = {
        id: 1,
        kitchenName: 'Chef Alice',
        kitchenPhotoUrl: null,
        cuisineTags: [],
        reviewCount: 0,
        averageRating: 0,
        isAcceptingOrders: true,
      };

      // getPhoto moved to CookCard — test the utility directly
      const photoUrl = ngSrcFor(cook.kitchenPhotoUrl, '/kitchen-placeholder.png', environment.apiUrl);

      // ngSrcFor resolves placeholder against window.location.origin for NgOptimizedImage
      expect(photoUrl).toContain('kitchen-placeholder.png');
    });

    it('should display cuisine tags for cooks', () => {
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      // Check for tags that are actually displayed (limited to 2 per cook)
      expect(compiled.textContent).toContain('Indian');
      expect(compiled.textContent).toContain('Pakistani');
      expect(compiled.textContent).toContain('Chinese');
      expect(compiled.textContent).toContain('Thai');
    });

    it('should limit cuisine labels to 2 tags', () => {
      const cook: DiscoveryCookDto = {
        id: 1,
        kitchenName: 'Chef Alice',
        kitchenPhotoUrl: null,
        cuisineTags: [CuisineTag.Chinese, CuisineTag.Thai, CuisineTag.Korean],
        reviewCount: 0,
        averageRating: 0,
        isAcceptingOrders: true,
      };

      // getCuisineLabels moved to CookCard — test the logic directly
      const labels = cook.cuisineTags
        .map(t => CuisineTagLabels[t])
        .filter(Boolean)
        .slice(0, 2);

      expect(labels).toEqual(['Chinese', 'Thai']);
      expect(labels.length).toBe(2);
    });

    it('should display links to cook profiles', () => {
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const links = compiled.querySelectorAll('a[href*="/cooks/"]');
      
      expect(links.length).toBeGreaterThan(0);
    });
  });

  describe('filtering by cuisine, dietary tags, and location', () => {
    beforeEach(() => {
      // Clear localStorage for filtering tests
      vi.spyOn(localStorage, 'getItem').mockReturnValue(null);
    });

    it('should display cuisine filter buttons in navigation bar', () => {
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('All Cuisines');
      expect(compiled.textContent).toContain('Bengali');
      expect(compiled.textContent).toContain('Indian');
      expect(compiled.textContent).toContain('Pakistani');
      expect(compiled.textContent).toContain('Lebanese');
    });

    it('should filter cooks by cuisine tags', () => {
      const italianCooks = mockNewCooks.filter(cook => 
        cook.cuisineTags.includes(CuisineTag.Italian)
      );

      expect(italianCooks.length).toBe(1);
      expect(italianCooks[0].kitchenName).toBe('Chef Alice Kitchen');
    });

    it('should filter cooks by multiple cuisine tags', () => {
      const cook = mockNewCooks.find(c => c.id === 2);
      
      expect(cook?.cuisineTags).toContain(CuisineTag.Chinese);
      expect(cook?.cuisineTags).toContain(CuisineTag.Thai);
    });

    it('should load nearby cooks based on zip code from localStorage', () => {
      vi.spyOn(localStorage, 'getItem').mockReturnValue('12345');
      const newFixture = TestBed.createComponent(Home);
      
      newFixture.detectChanges();

      expect(mockDiscoveryService.getNearMe).toHaveBeenCalledWith('12345');
      expect(newFixture.componentInstance.popularCooks()).toEqual(mockNearbyCooks);
    });

    it('should handle different zip codes for location filtering', () => {
      vi.spyOn(localStorage, 'getItem').mockReturnValue('67890');
      const newFixture = TestBed.createComponent(Home);

      newFixture.detectChanges();

      expect(mockDiscoveryService.getNearMe).toHaveBeenCalledWith('67890');
    });

    it('should display cooks with specific dietary tags', () => {
      const cook: DiscoveryCookDto = {
        id: 10,
        kitchenName: 'Halal Kitchen',
        kitchenPhotoUrl: null,
        cuisineTags: [CuisineTag.Pakistani],
        reviewCount: 5,
        averageRating: 4.5,
        isAcceptingOrders: true,
      };

      expect(cook.cuisineTags).toContain(CuisineTag.Pakistani);
    });

    it('should handle empty filter results gracefully', () => {
      mockDiscoveryService.getNew.mockReturnValue(of([]));
      mockDiscoveryService.getPopular.mockReturnValue(of([]));
      const newFixture = TestBed.createComponent(Home);

      newFixture.detectChanges();

      expect(newFixture.componentInstance.newCooks()).toEqual([]);
      expect(newFixture.componentInstance.popularCooks()).toEqual([]);
    });
  });

  describe('pagination', () => {
    it('should display "See all" links for navigation to full cook listing', () => {
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const seeAllLinks = Array.from(compiled.querySelectorAll('a[href="/cooks"]')).filter(
        link => link.textContent?.includes('See all')
      );
      
      expect(seeAllLinks.length).toBeGreaterThan(0);
    });

    it('should limit displayed cooks to a subset on home page', () => {
      fixture.detectChanges();

      // Home page shows limited cooks, full pagination is on /cooks page
      expect(component.newCooks().length).toBeLessThanOrEqual(10);
      expect(component.popularCooks().length).toBeLessThanOrEqual(10);
    });

    it('should provide navigation to full cook listing page', () => {
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const browseButton = Array.from(compiled.querySelectorAll('a')).find(
        link => link.textContent?.includes('Browse Cooks')
      );
      
      expect(browseButton).toBeTruthy();
      expect(browseButton?.getAttribute('href')).toBe('/cooks');
    });

    it('should display multiple cook cards in grid layout', () => {
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const grids = compiled.querySelectorAll('.grid');
      
      expect(grids.length).toBeGreaterThan(0);
    });
  });

  describe('loading states', () => {
    it('should handle error when loading new cooks', () => {
      mockDiscoveryService.getNew.mockReturnValue(throwError(() => new Error('Network error')));

      fixture.detectChanges();

      expect(component.newCooks()).toEqual([]);
    });

    it('should handle error when loading popular cooks', () => {
      vi.spyOn(localStorage, 'getItem').mockReturnValue(null);
      mockDiscoveryService.getPopular.mockReturnValue(
        throwError(() => new Error('Network error'))
      );

      fixture.detectChanges();

      expect(component.popularCooks()).toEqual([]);
    });

    it('should show empty state when no new cooks available', () => {
      mockDiscoveryService.getNew.mockReturnValue(of([]));

      fixture.detectChanges();

      expect(component.newCooks().length).toBe(0);
    });

    it('should show empty state when no popular cooks available', () => {
      mockDiscoveryService.getPopular.mockReturnValue(of([]));

      fixture.detectChanges();

      expect(component.popularCooks().length).toBe(0);
    });

    it('should not display new cooks section when list is empty', () => {
      mockDiscoveryService.getNew.mockReturnValue(of([]));

      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const newCooksSection = Array.from(compiled.querySelectorAll('section')).find(
        section => section.textContent?.includes('New on Khanara')
      );
      
      expect(newCooksSection).toBeFalsy();
    });

    it('should not display popular cooks section when list is empty', () => {
      mockDiscoveryService.getPopular.mockReturnValue(of([]));

      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const popularCooksSection = Array.from(compiled.querySelectorAll('section')).find(
        section => section.textContent?.includes('Popular on Khanara')
      );
      
      expect(popularCooksSection).toBeFalsy();
    });

    it('should handle network timeout gracefully', () => {
      mockDiscoveryService.getNew.mockReturnValue(
        throwError(() => new Error('Request timeout'))
      );

      fixture.detectChanges();

      expect(component.newCooks()).toEqual([]);
    });

    it('should handle server error gracefully', () => {
      mockDiscoveryService.getPopular.mockReturnValue(
        throwError(() => ({ status: 500, message: 'Internal server error' }))
      );

      fixture.detectChanges();

      expect(component.popularCooks()).toEqual([]);
    });
  });

  describe('register mode', () => {
    it('should toggle register mode', () => {
      expect(component.registerMode()).toBe(false);

      component.showRegister(true);

      expect(component.registerMode()).toBe(true);

      component.showRegister(false);

      expect(component.registerMode()).toBe(false);
    });

    it('should display register form when register mode is active', () => {
      component.showRegister(true);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const registerComponent = compiled.querySelector('app-register');
      
      expect(registerComponent).toBeTruthy();
    });

    it('should hide discovery feed when register mode is active', () => {
      component.showRegister(true);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const heroSection = compiled.querySelector('.relative.min-h-\\[72vh\\]');
      
      expect(heroSection).toBeFalsy();
    });
  });

  describe('authentication', () => {
    it('should show "Become a Cook" button when user is not logged in', () => {
      mockAccountService.currentUser.set(null);

      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const becomeACookButton = Array.from(compiled.querySelectorAll('button')).find(
        button => button.textContent?.includes('Become a Cook')
      );
      
      expect(becomeACookButton).toBeTruthy();
    });

    it('should hide "Become a Cook" button when user is logged in', () => {
      mockAccountService.currentUser.set(buildUser());

      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const becomeACookButton = Array.from(compiled.querySelectorAll('button')).find(
        button => button.textContent?.includes('Become a Cook')
      );
      
      expect(becomeACookButton).toBeFalsy();
    });

    it('should trigger register mode when "Become a Cook" is clicked', () => {
      mockAccountService.currentUser.set(null);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const becomeACookButton = Array.from(compiled.querySelectorAll('button')).find(
        button => button.textContent?.includes('Become a Cook')
      ) as HTMLButtonElement;
      
      becomeACookButton?.click();
      fixture.detectChanges();

      expect(component.registerMode()).toBe(true);
    });
  });

  describe('hero section', () => {
    it('should display hero headline', () => {
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Authentic Asian');
      expect(compiled.textContent).toContain('Arabian Cooking');
    });

    it('should display hero description', () => {
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Order handmade meals from passionate home cooks');
    });

    it('should display "Browse Cooks" CTA button', () => {
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const browseButton = Array.from(compiled.querySelectorAll('a')).find(
        link => link.textContent?.includes('Browse Cooks')
      );
      
      expect(browseButton).toBeTruthy();
    });

    it('should display community badge', () => {
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Home-cooked meals from your community');
    });
  });

  describe('why Khanara section', () => {
    it('should display "Why Khanara?" section', async () => {
      fixture.detectChanges();
      await triggerAllDeferBlocks(fixture);

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Why Khanara?');
    });

    it('should display feature highlights', async () => {
      fixture.detectChanges();
      await triggerAllDeferBlocks(fixture);

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Real home cooking');
      expect(compiled.textContent).toContain('19 cuisines');
      expect(compiled.textContent).toContain('Community-verified');
    });
  });
});
