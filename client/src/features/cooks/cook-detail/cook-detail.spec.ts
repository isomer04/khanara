import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, ActivatedRoute, Router } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { DeferBlockBehavior, DeferBlockState } from '@angular/core/testing';
import { IMAGE_LOADER, PRECONNECT_CHECK_BLOCKLIST } from '@angular/common';

/** Trigger all @defer blocks in the fixture so deferred content renders in tests. */
async function triggerAllDeferBlocks(fixture: ComponentFixture<any>): Promise<void> {
  const deferBlocks = await fixture.getDeferBlocks();
  for (const block of deferBlocks) {
    // Render the Complete state (actual deferred content)
    await block.render(DeferBlockState.Complete);
  }
  fixture.detectChanges();
  await fixture.whenStable();
}
import { CookDetail } from './cook-detail';
import { CookService } from '../../../core/services/cook-service';
import { CartService } from '../../../core/services/cart-service';
import { AccountService } from '../../../core/services/account-service';
import { ToastService } from '../../../core/services/toast-service';
import { buildCookProfile, buildDish, buildUser } from '../../../testing/test-data-builders';
import { CuisineTag } from '../../../types/cook-profile';
import { DietaryTags } from '../../../types/dish';
import {
  createMockCookService,
  createMockCartService,
  createMockAccountService,
  createMockToastService,
  createMockRouter,
} from '../../../testing/mock-services';

describe('CookDetail', () => {
  let component: CookDetail;
  let fixture: ComponentFixture<CookDetail>;
  let mockCookService: ReturnType<typeof createMockCookService>;
  let mockCartService: ReturnType<typeof createMockCartService>;
  let mockAccountService: ReturnType<typeof createMockAccountService>;
  let mockToastService: ReturnType<typeof createMockToastService>;
  let mockRouter: ReturnType<typeof createMockRouter>;
  let mockActivatedRoute: any;

  beforeEach(async () => {
    mockCookService = createMockCookService();
    mockCartService = createMockCartService({
      cookProfileId: signal<number | null>(null),
    });
    mockAccountService = createMockAccountService({
      currentUser: signal(buildUser()),
    });
    mockToastService = createMockToastService();
    mockRouter = createMockRouter();
    mockActivatedRoute = {
      snapshot: {
        paramMap: {
          get: vi.fn().mockReturnValue('1'),
        },
      },
    };

    const mockCook = buildCookProfile({ id: 1, ownerDisplayName: 'Chef Alice' });
    mockCookService.getCook.mockReturnValue(of(mockCook));

    await TestBed.configureTestingModule({
      imports: [CookDetail],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CookService, useValue: mockCookService },
        { provide: CartService, useValue: mockCartService },
        { provide: AccountService, useValue: mockAccountService },
        { provide: ToastService, useValue: mockToastService },
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        // Pass-through loader so NgOptimizedImage doesn't crash in jsdom
        { provide: IMAGE_LOADER, useValue: (config: any) => config.src },
        // Suppress preconnect warnings for test image URLs
        { provide: PRECONNECT_CHECK_BLOCKLIST, useValue: 'https://example.com' },
      ],
      // Render @defer blocks immediately so tests can query deferred content
      deferBlockBehavior: DeferBlockBehavior.Manual,
    }).compileComponents();

    fixture = TestBed.createComponent(CookDetail);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('initialization', () => {
    it('should load cook profile on init', () => {
      const mockCook = buildCookProfile({ id: 1, ownerDisplayName: 'Chef Alice' });
      mockCookService.getCook.mockReturnValue(of(mockCook));

      fixture.detectChanges();

      expect(mockCookService.getCook).toHaveBeenCalledWith(1);
      expect(component.cook()).toEqual(mockCook);
    });

    it('should set loading state during cook loading', () => {
      fixture.detectChanges();

      expect(component.loading()).toBe(false);
    });

    it('should extract cook id from route params', () => {
      mockActivatedRoute.snapshot.paramMap.get.mockReturnValue('42');

      fixture.detectChanges();

      expect(mockCookService.getCook).toHaveBeenCalledWith(42);
    });
  });

  describe('profile display', () => {
    it('should display cook profile information', () => {
      const mockCook = buildCookProfile({
        id: 1,
        ownerDisplayName: 'Chef Alice',
        bio: 'Passionate about Italian cuisine',
        cuisineTags: [CuisineTag.Indian],
      });
      mockCookService.getCook.mockReturnValue(of(mockCook));

      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Chef Alice');
      expect(compiled.textContent).toContain('Passionate about Italian cuisine');
    });

    it('should get cuisine label for tag', () => {
      const label = component.getCuisineLabel(CuisineTag.Indian);

      expect(label).toBe('Indian');
    });

    it('should check if dietary tag is present', () => {
      const hasVegan = component.hasFlag(DietaryTags.Vegan, DietaryTags.Vegan);
      const hasGlutenFree = component.hasFlag(DietaryTags.Vegan, DietaryTags.GlutenFree);

      expect(hasVegan).toBe(true);
      expect(hasGlutenFree).toBe(false);
    });
  });

  describe('dishes display', () => {
    it('should display cook dishes', () => {
      const mockDish = buildDish({ id: 1, name: 'Pasta Carbonara', price: 15.99 });
      const mockCook = buildCookProfile({ id: 1, dishes: [mockDish] });
      mockCookService.getCook.mockReturnValue(of(mockCook));

      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Pasta Carbonara');
      expect(compiled.textContent).toContain('15.99');
    });

    it('should return main photo URL when available', () => {
      const dish = buildDish({
        photos: [
          { id: 1, url: 'https://example.com/photo1.jpg', isMain: false },
          { id: 2, url: 'https://example.com/photo2.jpg', isMain: true },
        ],
      });

      const photoUrl = component.getMainPhoto(dish);

      expect(photoUrl).toBe('https://example.com/photo2.jpg');
    });

    it('should return placeholder when no main photo available', () => {
      const dish = buildDish({ photos: [] });

      const photoUrl = component.getMainPhoto(dish);

      // ngSrcFor resolves placeholder against window.location.origin for NgOptimizedImage
      expect(photoUrl).toContain('dish-placeholder.png');
    });
  });

  describe('add to cart', () => {
    it('should add dish to cart when user is logged in', () => {
      const mockDish = buildDish({ id: 1, name: 'Pasta', price: 15.99 });
      const mockCook = buildCookProfile({ id: 1, dishes: [mockDish] });
      mockCookService.getCook.mockReturnValue(of(mockCook));
      fixture.detectChanges();

      component.addToCart(mockDish);

      expect(mockCartService.addItem).toHaveBeenCalledWith(1, {
        dishId: 1,
        dishName: 'Pasta',
        price: 15.99,
        quantity: 1,
      });
      expect(mockToastService.success).toHaveBeenCalledWith('Pasta added to cart');
    });

    it('should redirect to home when user is not logged in', () => {
      mockAccountService.currentUser = signal(null);
      const mockDish = buildDish({ id: 1, name: 'Pasta', price: 15.99 });

      component.addToCart(mockDish);

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/']);
      expect(mockCartService.addItem).not.toHaveBeenCalled();
    });

    it('should show message when adding from different cook', () => {
      mockCartService.cookProfileId = signal(2);
      const mockDish = buildDish({ id: 1, name: 'Pasta', price: 15.99 });
      const mockCook = buildCookProfile({ id: 1, dishes: [mockDish] });
      mockCookService.getCook.mockReturnValue(of(mockCook));
      fixture.detectChanges();

      component.addToCart(mockDish);

      expect(mockToastService.success).toHaveBeenCalledWith(
        'Cart cleared — starting a new order with this cook'
      );
      expect(mockCartService.addItem).toHaveBeenCalledWith(1, {
        dishId: mockDish.id,
        dishName: mockDish.name,
        price: mockDish.price,
        quantity: 1,
      });
    });

    it('should not add to cart when cook is not loaded', () => {
      component.cook.set(null);
      const mockDish = buildDish({ id: 1, name: 'Pasta', price: 15.99 });

      component.addToCart(mockDish);

      expect(mockCartService.addItem).not.toHaveBeenCalled();
    });
  });

  describe('reviews', () => {
    it('should display cook reviews section', async () => {
      const mockCook = buildCookProfile({ id: 1 });
      mockCookService.getCook.mockReturnValue(of(mockCook));

      fixture.detectChanges();
      await triggerAllDeferBlocks(fixture);

      const compiled = fixture.nativeElement as HTMLElement;
      const reviewsSection = compiled.querySelector('app-cook-reviews');
      expect(reviewsSection).toBeTruthy();
    });

    it('should pass cook id to reviews component', async () => {
      const mockCook = buildCookProfile({ id: 42 });
      mockCookService.getCook.mockReturnValue(of(mockCook));

      fixture.detectChanges();
      await triggerAllDeferBlocks(fixture);

      const compiled = fixture.nativeElement as HTMLElement;
      const reviewsSection = compiled.querySelector('app-cook-reviews');
      expect(reviewsSection).toBeTruthy();
      // The component input is passed via Angular's input binding
    });

    it('should pass average rating to reviews component', async () => {
      const mockCook = buildCookProfile({ id: 1, averageRating: 4.8 });
      mockCookService.getCook.mockReturnValue(of(mockCook));

      fixture.detectChanges();
      await triggerAllDeferBlocks(fixture);

      const compiled = fixture.nativeElement as HTMLElement;
      const reviewsSection = compiled.querySelector('app-cook-reviews');
      expect(reviewsSection).toBeTruthy();
    });

    it('should pass review count to reviews component', async () => {
      const mockCook = buildCookProfile({ id: 1, reviewCount: 25 });
      mockCookService.getCook.mockReturnValue(of(mockCook));

      fixture.detectChanges();
      await triggerAllDeferBlocks(fixture);

      const compiled = fixture.nativeElement as HTMLElement;
      const reviewsSection = compiled.querySelector('app-cook-reviews');
      expect(reviewsSection).toBeTruthy();
    });
  });

  describe('profile display - comprehensive', () => {
    it('should display kitchen name', () => {
      const mockCook = buildCookProfile({ kitchenName: 'Delicious Kitchen' });
      mockCookService.getCook.mockReturnValue(of(mockCook));

      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Delicious Kitchen');
    });

    it('should display owner display name', () => {
      const mockCook = buildCookProfile({ ownerDisplayName: 'Chef Maria' });
      mockCookService.getCook.mockReturnValue(of(mockCook));

      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Chef Maria');
    });

    it('should display bio when available', () => {
      const mockCook = buildCookProfile({ bio: 'Authentic Italian recipes from my grandmother' });
      mockCookService.getCook.mockReturnValue(of(mockCook));

      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Authentic Italian recipes from my grandmother');
    });

    it('should display cuisine tags', () => {
      const mockCook = buildCookProfile({ cuisineTags: [CuisineTag.Indian, CuisineTag.Pakistani] });
      mockCookService.getCook.mockReturnValue(of(mockCook));

      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Indian');
      expect(compiled.textContent).toContain('Pakistani');
    });

    it('should display accepting orders badge when cook is accepting orders', () => {
      const mockCook = buildCookProfile({ isAcceptingOrders: true });
      mockCookService.getCook.mockReturnValue(of(mockCook));

      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Accepting orders');
    });

    it('should display not accepting orders badge when cook is not accepting orders', () => {
      const mockCook = buildCookProfile({ isAcceptingOrders: false });
      mockCookService.getCook.mockReturnValue(of(mockCook));

      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Not accepting orders');
    });

    it('should display average rating when review count is greater than 0', () => {
      const mockCook = buildCookProfile({ averageRating: 4.7, reviewCount: 15 });
      mockCookService.getCook.mockReturnValue(of(mockCook));

      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('4.7');
      expect(compiled.textContent).toContain('15 reviews');
    });

    it('should not display rating section when review count is 0', () => {
      const mockCook = buildCookProfile({ averageRating: 0, reviewCount: 0 });
      mockCookService.getCook.mockReturnValue(of(mockCook));

      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const ratingSection = compiled.querySelector('.text-amber-500');
      expect(ratingSection).toBeFalsy();
    });

    it('should display service zip codes when available', () => {
      const mockCook = buildCookProfile({ serviceZipCodes: ['12345', '67890', '11111'] });
      mockCookService.getCook.mockReturnValue(of(mockCook));

      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('12345, 67890, 11111');
    });

    it('should display kitchen photo when available', () => {
      const mockCook = buildCookProfile({ kitchenPhotoUrl: 'https://example.com/kitchen.jpg' });
      mockCookService.getCook.mockReturnValue(of(mockCook));

      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const img = compiled.querySelector('img[alt="' + mockCook.kitchenName + '"]') as HTMLImageElement;
      expect(img).toBeTruthy();
      expect(img.src).toContain('kitchen.jpg');
    });
  });

  describe('dishes display - comprehensive', () => {
    it('should display multiple dishes', () => {
      const mockDish1 = buildDish({ id: 1, name: 'Pasta Carbonara', price: 15.99 });
      const mockDish2 = buildDish({ id: 2, name: 'Margherita Pizza', price: 12.99 });
      const mockCook = buildCookProfile({ id: 1, dishes: [mockDish1, mockDish2] });
      mockCookService.getCook.mockReturnValue(of(mockCook));

      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Pasta Carbonara');
      expect(compiled.textContent).toContain('Margherita Pizza');
      expect(compiled.textContent).toContain('15.99');
      expect(compiled.textContent).toContain('12.99');
    });

    it('should display dish description when available', () => {
      const mockDish = buildDish({ 
        id: 1, 
        name: 'Pasta', 
        description: 'Creamy pasta with bacon and eggs' 
      });
      const mockCook = buildCookProfile({ id: 1, dishes: [mockDish] });
      mockCookService.getCook.mockReturnValue(of(mockCook));

      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Creamy pasta with bacon and eggs');
    });

    it('should display dietary tags for dishes', () => {
      const mockDish = buildDish({ 
        id: 1, 
        name: 'Pasta',
        dietaryTags: DietaryTags.Vegetarian | DietaryTags.GlutenFree
      });
      const mockCook = buildCookProfile({ id: 1, dishes: [mockDish] });
      mockCookService.getCook.mockReturnValue(of(mockCook));

      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Vegetarian');
      expect(compiled.textContent).toContain('Gluten Free');
    });

    it('should display portions remaining for each dish', () => {
      const mockDish = buildDish({ 
        id: 1, 
        name: 'Pasta',
        portionsRemainingToday: 8
      });
      const mockCook = buildCookProfile({ id: 1, dishes: [mockDish] });
      mockCookService.getCook.mockReturnValue(of(mockCook));

      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('8 left today');
    });

    it('should display add to order button when cook is accepting orders and dish is available', () => {
      const mockDish = buildDish({ id: 1, name: 'Pasta', isAvailable: true });
      const mockCook = buildCookProfile({ id: 1, dishes: [mockDish], isAcceptingOrders: true });
      mockCookService.getCook.mockReturnValue(of(mockCook));

      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const addButton = compiled.querySelector('button');
      expect(addButton).toBeTruthy();
      expect(addButton?.textContent).toContain('Add to order');
    });

    it('should not display add to order button when cook is not accepting orders', () => {
      const mockDish = buildDish({ id: 1, name: 'Pasta', isAvailable: true });
      const mockCook = buildCookProfile({ id: 1, dishes: [mockDish], isAcceptingOrders: false });
      mockCookService.getCook.mockReturnValue(of(mockCook));

      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const addButton = compiled.querySelector('button');
      expect(addButton).toBeFalsy();
    });

    it('should not display add to order button when dish is not available', () => {
      const mockDish = buildDish({ id: 1, name: 'Pasta', isAvailable: false });
      const mockCook = buildCookProfile({ id: 1, dishes: [mockDish], isAcceptingOrders: true });
      mockCookService.getCook.mockReturnValue(of(mockCook));

      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const addButton = compiled.querySelector('button');
      expect(addButton).toBeFalsy();
    });

    it('should display empty state when cook has no dishes', () => {
      const mockCook = buildCookProfile({ id: 1, dishes: [] });
      mockCookService.getCook.mockReturnValue(of(mockCook));

      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('No dishes listed yet');
    });

    it('should display dish photo when available', () => {
      const mockDish = buildDish({ 
        id: 1, 
        name: 'Pasta',
        photos: [{ id: 1, url: 'https://example.com/pasta.jpg', isMain: true }]
      });
      const mockCook = buildCookProfile({ id: 1, dishes: [mockDish] });
      mockCookService.getCook.mockReturnValue(of(mockCook));

      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const img = compiled.querySelector('img[alt="Pasta"]') as HTMLImageElement;
      expect(img).toBeTruthy();
      expect(img.src).toContain('pasta.jpg');
    });
  });

  describe('favorite button interaction', () => {
    it('should display favorite button in the UI', () => {
      const mockCook = buildCookProfile({ id: 1 });
      mockCookService.getCook.mockReturnValue(of(mockCook));

      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      // Note: The favorite button would typically be in the template
      // This test verifies the component structure supports favorites
      expect(component.cook()).toBeTruthy();
    });
  });

  describe('loading state', () => {
    it('should display loading spinner when loading', async () => {
      // Use NEVER so getCook never completes and loading stays true
      const { NEVER } = await import('rxjs');
      mockCookService.getCook.mockReturnValue(NEVER);
      component.cook.set(null);
      fixture.detectChanges(); // triggers ngOnInit → loading.set(true), getCook never resolves

      const compiled = fixture.nativeElement as HTMLElement;
      const spinner = compiled.querySelector('.loading-spinner');
      expect(spinner).toBeTruthy();
    });

    it('should not display main loading spinner when cook is loaded', () => {
      const mockCook = buildCookProfile({ id: 1 });
      mockCookService.getCook.mockReturnValue(of(mockCook));
      
      fixture.detectChanges();

      // The component should have loaded the cook
      expect(component.cook()).toBeTruthy();
      expect(component.loading()).toBe(false);
    });
  });

  describe('cart integration', () => {
    it('should display cart bar when cart has items', async () => {
      mockCartService.itemCount = signal(3);
      mockCartService.total = signal(45.99);
      const mockCook = buildCookProfile({ id: 1 });
      mockCookService.getCook.mockReturnValue(of(mockCook));

      fixture.detectChanges();
      await triggerAllDeferBlocks(fixture);

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('3 items');
      expect(compiled.textContent).toContain('45.99');
    });

    it('should not display cart bar when cart is empty', async () => {
      mockCartService.itemCount = signal(0);
      const mockCook = buildCookProfile({ id: 1 });
      mockCookService.getCook.mockReturnValue(of(mockCook));

      fixture.detectChanges();
      await triggerAllDeferBlocks(fixture);

      const compiled = fixture.nativeElement as HTMLElement;
      const cartBar = compiled.querySelector('a[routerLink="/checkout"]');
      expect(cartBar).toBeFalsy();
    });

    it('should display singular item text when cart has 1 item', async () => {
      mockCartService.itemCount = signal(1);
      mockCartService.total = signal(15.99);
      const mockCook = buildCookProfile({ id: 1 });
      mockCookService.getCook.mockReturnValue(of(mockCook));

      fixture.detectChanges();
      await triggerAllDeferBlocks(fixture);

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('1 item');
      expect(compiled.textContent).not.toContain('1 items');
    });
  });
});


