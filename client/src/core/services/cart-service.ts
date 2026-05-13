import { Injectable, signal, computed, effect } from '@angular/core';
import { CartItem } from '../../types/order';

const CART_STORAGE_KEY = 'khanara_cart';
const COOK_STORAGE_KEY = 'khanara_cart_cook';

@Injectable({ providedIn: 'root' })
export class CartService {
  private _items = signal<CartItem[]>(this.loadItemsFromStorage());
  private _cookProfileId = signal<number | null>(this.loadCookIdFromStorage());

  readonly items = this._items.asReadonly();
  readonly cookProfileId = this._cookProfileId.asReadonly();
  readonly itemCount = computed(() => this._items().reduce((sum, i) => sum + i.quantity, 0));
  readonly total = computed(() =>
    this._items().reduce((sum, i) => sum + i.price * i.quantity, 0)
  );

  constructor() {
    // Persist cart to localStorage whenever items or cookProfileId change
    effect(() => {
      const items = this._items();
      const cookId = this._cookProfileId();
      this.persistToStorage(items, cookId);
    });
  }

  private persistToStorage(items: CartItem[], cookId: number | null): void {
    try {
      if (items.length === 0) {
        localStorage.removeItem(CART_STORAGE_KEY);
        localStorage.removeItem(COOK_STORAGE_KEY);
      } else {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
        if (cookId !== null) {
          localStorage.setItem(COOK_STORAGE_KEY, cookId.toString());
        }
      }
    } catch (error) {
      // localStorage can fail in private browsing, quota exceeded, or sandboxed iframes
      // Cart remains functional in-memory; persistence is a nice-to-have feature
      console.warn('Failed to persist cart to localStorage:', error);
    }
  }

  private loadItemsFromStorage(): CartItem[] {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private loadCookIdFromStorage(): number | null {
    try {
      const stored = localStorage.getItem(COOK_STORAGE_KEY);
      if (!stored) return null;
      const num = parseInt(stored, 10);
      return isNaN(num) ? null : num;
    } catch {
      return null;
    }
  }

  addItem(cookProfileId: number, item: CartItem) {
    if (this._cookProfileId() !== null && this._cookProfileId() !== cookProfileId) {
      this.clear();
    }
    this._cookProfileId.set(cookProfileId);

    const existing = this._items().find(i => i.dishId === item.dishId);
    if (existing) {
      this._items.update(items =>
        items.map(i => i.dishId === item.dishId ? { ...i, quantity: i.quantity + item.quantity } : i)
      );
    } else {
      this._items.update(items => [...items, item]);
    }
  }

  removeItem(dishId: number) {
    this._items.update(items => items.filter(i => i.dishId !== dishId));
    if (this._items().length === 0) this._cookProfileId.set(null);
  }

  updateQuantity(dishId: number, quantity: number) {
    if (quantity < 1) {
      this.removeItem(dishId);
      return;
    }
    this._items.update(items =>
      items.map(i => i.dishId === dishId ? { ...i, quantity } : i)
    );
  }

  clear() {
    this._items.set([]);
    this._cookProfileId.set(null);
  }
}
