import { User } from '../types/user';
import { CookProfile, CuisineTag } from '../types/cook-profile';
import { Dish, DietaryTags, DishPhoto } from '../types/dish';
import { Order, OrderItem, OrderStatus, PaymentMethod, PaymentStatus, FulfillmentType, CartItem } from '../types/order';
import { Review } from '../types/review';
import { FavoriteDto } from '../types/favorite';
import { PaginatedResult, Pagination } from '../types/pagination';

/**
 * Builds a User object with sensible defaults
 * 
 * @example
 * ```typescript
 * const user = buildUser({ displayName: 'John Doe' });
 * ```
 */
export function buildUser(overrides?: Partial<User>): User {
  return {
    id: 'user-123',
    displayName: 'Test User',
    email: 'test@example.com',
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyIsInJvbGUiOlsiTWVtYmVyIl19.test',
    imageUrl: 'https://example.com/avatar.jpg',
    roles: ['Member'],
    ...overrides,
  };
}

/**
 * Builds a User object with specific roles
 * Encodes the roles in the JWT token to match AccountService behavior
 * 
 * @example
 * ```typescript
 * const admin = buildUserWithRoles(['Admin', 'Moderator']);
 * ```
 */
export function buildUserWithRoles(roles: string[]): User {
  // Create a JWT token with the specified roles
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ sub: 'user-123', role: roles }));
  const signature = 'test-signature';
  const token = `${header}.${payload}.${signature}`;
  
  return buildUser({ roles, token });
}

/**
 * Builds a CookProfile object with sensible defaults
 * 
 * @example
 * ```typescript
 * const cook = buildCookProfile({ kitchenName: 'My Kitchen' });
 * ```
 */
export function buildCookProfile(overrides?: Partial<CookProfile>): CookProfile {
  return {
    id: 1,
    appUserId: 'user-123',
    kitchenName: 'Test Kitchen',
    bio: 'A test kitchen serving delicious food',
    cuisineTags: [CuisineTag.Indian, CuisineTag.Pakistani],
    serviceZipCodes: ['12345', '67890'],
    kitchenPhotoUrl: 'https://example.com/kitchen.jpg',
    isAcceptingOrders: true,
    averageRating: 4.5,
    reviewCount: 10,
    createdAt: new Date().toISOString(),
    ownerDisplayName: 'Test User',
    dishes: [],
    ...overrides,
  };
}

/**
 * Builds a Dish object with sensible defaults
 * 
 * @example
 * ```typescript
 * const dish = buildDish({ name: 'Biryani', price: 15.99 });
 * ```
 */
export function buildDish(overrides?: Partial<Dish>): Dish {
  return {
    id: 1,
    cookProfileId: 1,
    name: 'Test Dish',
    description: 'A delicious test dish',
    price: 12.99,
    cuisineTag: CuisineTag.Indian,
    dietaryTags: DietaryTags.Halal,
    portionsPerBatch: 10,
    portionsRemainingToday: 5,
    isAvailable: true,
    createdAt: new Date().toISOString(),
    photos: [],
    ...overrides,
  };
}

/**
 * Builds a Dish object with multiple photos
 * 
 * @example
 * ```typescript
 * const dish = buildDishWithPhotos(3);
 * ```
 */
export function buildDishWithPhotos(photoCount: number): Dish {
  const photos: DishPhoto[] = Array.from({ length: photoCount }, (_, i) => ({
    id: i + 1,
    url: `https://example.com/dish-photo-${i + 1}.jpg`,
    isMain: i === 0,
  }));

  return buildDish({ photos });
}

/**
 * Builds an Order object with sensible defaults
 * 
 * @example
 * ```typescript
 * const order = buildOrder({ totalAmount: 50.00 });
 * ```
 */
export function buildOrder(overrides?: Partial<Order>): Order {
  return {
    id: 1,
    eaterUserId: 'user-123',
    eaterDisplayName: 'Test User',
    cookProfileId: 1,
    cookKitchenName: 'Test Kitchen',
    status: OrderStatus.Pending,
    paymentMethod: PaymentMethod.Stripe,
    paymentStatus: PaymentStatus.Paid,
    fulfillmentType: FulfillmentType.Pickup,
    totalAmount: 25.98,
    scheduledFor: new Date(Date.now() + 86400000).toISOString(),
    notes: 'Test order notes',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items: [],
    ...overrides,
  };
}

/**
 * Builds an Order object with multiple items
 * 
 * @example
 * ```typescript
 * const order = buildOrderWithItems(3);
 * ```
 */
export function buildOrderWithItems(itemCount: number): Order {
  const items: OrderItem[] = Array.from({ length: itemCount }, (_, i) => ({
    id: i + 1,
    dishId: i + 1,
    dishName: `Test Dish ${i + 1}`,
    quantity: 2,
    unitPriceSnapshot: 12.99,
  }));

  const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.unitPriceSnapshot, 0);

  return buildOrder({ items, totalAmount });
}

/**
 * Builds a CartItem object with sensible defaults
 * 
 * @example
 * ```typescript
 * const cartItem = buildCartItem({ quantity: 3 });
 * ```
 */
export function buildCartItem(overrides?: Partial<CartItem>): CartItem {
  return {
    dishId: 1,
    dishName: 'Test Dish',
    price: 12.99,
    quantity: 1,
    ...overrides,
  };
}

/**
 * Builds a Review object with sensible defaults
 * 
 * @example
 * ```typescript
 * const review = buildReview({ rating: 5 });
 * ```
 */
export function buildReview(overrides?: Partial<Review>): Review {
  return {
    id: 1,
    orderId: 1,
    rating: 4,
    comment: 'Great food!',
    authorDisplayName: 'Test User',
    authorPhotoUrl: 'https://example.com/avatar.jpg',
    cookReply: null,
    cookRepliedAt: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Builds a FavoriteDto object with sensible defaults
 * 
 * @example
 * ```typescript
 * const favorite = buildFavorite({ kitchenName: 'My Favorite Kitchen' });
 * ```
 */
export function buildFavorite(overrides?: Partial<FavoriteDto>): FavoriteDto {
  return {
    cookProfileId: 1,
    kitchenName: 'Test Kitchen',
    kitchenPhotoUrl: 'https://example.com/kitchen.jpg',
    averageRating: 4.5,
    reviewCount: 10,
    isAcceptingOrders: true,
    favoritedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Builds a PaginatedResult object
 * 
 * @example
 * ```typescript
 * const users = [buildUser(), buildUser()];
 * const result = buildPaginatedResult(users, 1, 10);
 * ```
 */
export function buildPaginatedResult<T>(
  items: T[],
  page: number = 1,
  pageSize: number = 10
): PaginatedResult<T> {
  const totalCount = items.length;
  const totalPages = Math.ceil(totalCount / pageSize);

  const metadata: Pagination = {
    currentPage: page,
    pageSize,
    totalCount,
    totalPages,
  };

  return {
    items,
    metadata,
  };
}
