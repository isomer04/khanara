import { TestBed } from '@angular/core/testing';
import { CartService } from './cart-service';
import { CartItem } from '../../types/order';

const makeDish = (dishId: number, price = 10): CartItem => ({
  dishId,
  dishName: `Dish ${dishId}`,
  price,
  quantity: 1,
});

describe('CartService', () => {
  let service: CartService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(CartService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should start with an empty cart', () => {
    expect(service.itemCount()).toBe(0);
    expect(service.total()).toBe(0);
    expect(service.cookProfileId()).toBeNull();
  });

  it('addItem increases itemCount', () => {
    service.addItem(1, makeDish(10));
    expect(service.itemCount()).toBe(1);
  });

  it('addItem stacks quantity for same dish', () => {
    service.addItem(1, makeDish(10));
    service.addItem(1, makeDish(10));
    expect(service.itemCount()).toBe(2);
    expect(service.items().length).toBe(1);
  });

  it('addItem from a different cook clears the cart first', () => {
    service.addItem(1, makeDish(10));
    service.addItem(2, makeDish(20));
    expect(service.cookProfileId()).toBe(2);
    expect(service.items().length).toBe(1);
    expect(service.items()[0].dishId).toBe(20);
  });

  it('total reflects price × quantity', () => {
    service.addItem(1, { ...makeDish(10, 15), quantity: 2 });
    expect(service.total()).toBe(30);
  });

  it('removeItem removes the dish', () => {
    service.addItem(1, makeDish(10));
    service.removeItem(10);
    expect(service.itemCount()).toBe(0);
  });

  it('removeItem resets cookProfileId when cart becomes empty', () => {
    service.addItem(1, makeDish(10));
    service.removeItem(10);
    expect(service.cookProfileId()).toBeNull();
  });

  it('updateQuantity adjusts quantity', () => {
    service.addItem(1, makeDish(10));
    service.updateQuantity(10, 5);
    expect(service.itemCount()).toBe(5);
  });

  it('updateQuantity with 0 removes the item', () => {
    service.addItem(1, makeDish(10));
    service.updateQuantity(10, 0);
    expect(service.items().length).toBe(0);
  });

  it('clear empties cart and resets cookProfileId', () => {
    service.addItem(1, makeDish(10));
    service.clear();
    expect(service.itemCount()).toBe(0);
    expect(service.cookProfileId()).toBeNull();
  });

  // ── localStorage persistence tests ──────────────────────────────────────

  function createFreshService(): CartService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    return TestBed.inject(CartService);
  }

  it('should persist cart items to localStorage', () => {
    service.addItem(1, makeDish(10));
    TestBed.flushEffects();
    
    const stored = localStorage.getItem('khanara_cart');
    expect(stored).toBeTruthy();
    const items = JSON.parse(stored!);
    expect(items.length).toBe(1);
    expect(items[0].dishId).toBe(10);
  });

  it('should persist cookProfileId to localStorage', () => {
    service.addItem(1, makeDish(10));
    TestBed.flushEffects();
    
    const stored = localStorage.getItem('khanara_cart_cook');
    expect(stored).toBe('1');
  });

  it('should load cart from localStorage on initialization', () => {
    localStorage.setItem('khanara_cart', JSON.stringify([makeDish(10), makeDish(20)]));
    localStorage.setItem('khanara_cart_cook', '1');
    
    const newService = createFreshService();
    
    expect(newService.itemCount()).toBe(2);
    expect(newService.cookProfileId()).toBe(1);
    expect(newService.items().length).toBe(2);
  });

  it('should clear localStorage when cart is emptied', () => {
    service.addItem(1, makeDish(10));
    TestBed.flushEffects();
    
    service.clear();
    TestBed.flushEffects();
    
    expect(localStorage.getItem('khanara_cart')).toBeNull();
    expect(localStorage.getItem('khanara_cart_cook')).toBeNull();
  });

  it('should handle corrupted localStorage data gracefully', () => {
    localStorage.setItem('khanara_cart', 'invalid json');
    localStorage.setItem('khanara_cart_cook', 'not a number');
    
    const newService = createFreshService();
    
    expect(newService.itemCount()).toBe(0);
    expect(newService.cookProfileId()).toBeNull();
  });

  it('should update localStorage when quantity changes', () => {
    service.addItem(1, makeDish(10));
    TestBed.flushEffects();
    
    service.updateQuantity(10, 3);
    TestBed.flushEffects();
    
    const stored = localStorage.getItem('khanara_cart');
    const items = JSON.parse(stored!);
    expect(items[0].quantity).toBe(3);
  });

  it('should survive page reload simulation', () => {
    service.addItem(1, makeDish(10, 15));
    service.addItem(1, makeDish(20, 25));
    TestBed.flushEffects();
    
    // Simulate page reload by creating a new service instance
    const reloadedService = createFreshService();
    
    expect(reloadedService.itemCount()).toBe(2);
    expect(reloadedService.total()).toBe(40);
    expect(reloadedService.cookProfileId()).toBe(1);
  });
});
