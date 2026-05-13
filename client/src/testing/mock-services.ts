import { signal, WritableSignal } from '@angular/core';
import { Observable, of, tap } from 'rxjs';
import { vi } from 'vitest';
import { User } from '../types/user';

/**
 * Creates a mock AccountService for testing
 * 
 * @example
 * ```typescript
 * const mockAccountService = createMockAccountService({
 *   currentUser: signal(buildUser())
 * });
 * ```
 */
export function createMockAccountService(overrides?: Partial<any>) {
  return {
    currentUser: signal<User | null>(null),
    register: vi.fn().mockReturnValue(of(null)),
    login: vi.fn().mockReturnValue(of(null)),
    logout: vi.fn(),
    refreshToken: vi.fn().mockReturnValue(of(null)),
    setCurrentUser: vi.fn(),
    startTokenRefreshInterval: vi.fn(),
    ...overrides,
  };
}

/**
 * Creates a mock HttpClient for testing
 * 
 * @example
 * ```typescript
 * const mockHttp = createMockHttpClient();
 * mockHttp.get.mockReturnValue(of({ data: 'test' }));
 * ```
 */
export function createMockHttpClient(overrides?: Partial<any>) {
  return {
    get: vi.fn().mockReturnValue(of(null)),
    post: vi.fn().mockReturnValue(of(null)),
    put: vi.fn().mockReturnValue(of(null)),
    delete: vi.fn().mockReturnValue(of(null)),
    patch: vi.fn().mockReturnValue(of(null)),
    ...overrides,
  };
}

/**
 * Creates a mock ToastService for testing
 * 
 * @example
 * ```typescript
 * const mockToast = createMockToastService();
 * ```
 */
export function createMockToastService(overrides?: Partial<any>) {
  return {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    ...overrides,
  };
}

/**
 * Creates a mock Router for testing
 * 
 * @example
 * ```typescript
 * const mockRouter = createMockRouter();
 * mockRouter.navigate.mockResolvedValue(true);
 * ```
 */
export function createMockRouter(overrides?: Partial<any>) {
  return {
    navigate: vi.fn().mockResolvedValue(true),
    navigateByUrl: vi.fn().mockResolvedValue(true),
    createUrlTree: vi.fn().mockReturnValue({}),
    serializeUrl: vi.fn().mockReturnValue('/'),
    url: '/',
    events: of(),
    ...overrides,
  };
}

/**
 * Creates a mock ConfirmDialogService for testing
 * 
 * @example
 * ```typescript
 * const mockConfirm = createMockConfirmDialogService();
 * mockConfirm.confirm.mockResolvedValue(true);
 * ```
 */
export function createMockConfirmDialogService(overrides?: Partial<any>) {
  return {
    register: vi.fn(),
    confirm: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

/**
 * Creates a mock CartService for testing
 * 
 * @example
 * ```typescript
 * const mockCart = createMockCartService();
 * ```
 */
export function createMockCartService(overrides?: Partial<any>) {
  return {
    items: signal([]),
    cookProfileId: signal<number | null>(null),
    itemCount: signal(0),
    total: signal(0),
    addItem: vi.fn(),
    removeItem: vi.fn(),
    updateQuantity: vi.fn(),
    clear: vi.fn(),
    ...overrides,
  };
}

/**
 * Creates a mock OrderService for testing
 * 
 * @example
 * ```typescript
 * const mockOrder = createMockOrderService();
 * ```
 */
export function createMockOrderService(overrides?: Partial<any>) {
  return {
    placeOrder: vi.fn().mockReturnValue(of(null)),
    getEaterOrders: vi.fn().mockReturnValue(of({ items: [], metadata: {} })),
    getCookOrders: vi.fn().mockReturnValue(of({ items: [], metadata: {} })),
    getOrder: vi.fn().mockReturnValue(of(null)),
    updateStatus: vi.fn().mockReturnValue(of(null)),
    cancelOrder: vi.fn().mockReturnValue(of(null)),
    createCheckoutSession: vi.fn().mockReturnValue(of({ sessionUrl: '' })),
    ...overrides,
  };
}

/**
 * Creates a mock DishService for testing
 * 
 * @example
 * ```typescript
 * const mockDish = createMockDishService();
 * ```
 */
export function createMockDishService(overrides?: Partial<any>) {
  return {
    getDishes: vi.fn().mockReturnValue(of({ items: [], pagination: {} })),
    getDish: vi.fn().mockReturnValue(of(null)),
    createDish: vi.fn().mockReturnValue(of(null)),
    updateDish: vi.fn().mockReturnValue(of(null)),
    deleteDish: vi.fn().mockReturnValue(of(null)),
    uploadPhoto: vi.fn().mockReturnValue(of(null)),
    deletePhoto: vi.fn().mockReturnValue(of(null)),
    ...overrides,
  };
}

/**
 * Creates a mock CookService for testing
 * 
 * @example
 * ```typescript
 * const mockCook = createMockCookService();
 * ```
 */
export function createMockCookService(overrides?: Partial<any>) {
  return {
    myCookProfile: signal<any>(null),
    getCooks: vi.fn().mockReturnValue(of({ items: [], pagination: {} })),
    getCook: vi.fn().mockReturnValue(of(null)),
    createCookProfile: vi.fn().mockReturnValue(of(null)),
    updateCookProfile: vi.fn().mockReturnValue(of(null)),
    loadMyCookProfile: vi.fn().mockReturnValue(of(null)),
    ...overrides,
  };
}

/**
 * Creates a mock FavoritesService for testing
 * 
 * @example
 * ```typescript
 * const mockFavorites = createMockFavoritesService();
 * ```
 */
export function createMockFavoritesService(overrides?: Partial<any>) {
  const favoriteIds = signal<Set<number>>(new Set());
  const loadFavoriteIdsMock = vi.fn().mockImplementation(() => {
    return of<number[]>([]).pipe(
      tap(ids => favoriteIds.set(new Set(ids)))
    );
  });
  
  return {
    favoriteIds,
    getFavorites: vi.fn().mockReturnValue(of({ items: [], pagination: {} })),
    addFavorite: vi.fn().mockReturnValue(of(null)),
    removeFavorite: vi.fn().mockReturnValue(of(null)),
    isFavorited: vi.fn().mockReturnValue(false),
    loadFavoriteIds: loadFavoriteIdsMock,
    clearFavoriteIds: vi.fn(),
    ...overrides,
  };
}

/**
 * Creates a mock ReviewService for testing
 * 
 * @example
 * ```typescript
 * const mockReview = createMockReviewService();
 * ```
 */
export function createMockReviewService(overrides?: Partial<any>) {
  return {
    createReview: vi.fn().mockReturnValue(of(null)),
    getReviewByOrder: vi.fn().mockReturnValue(of(null)),
    getReviewsForCook: vi.fn().mockReturnValue(of({ items: [], metadata: {} })),
    addReply: vi.fn().mockReturnValue(of(null)),
    ...overrides,
  };
}
