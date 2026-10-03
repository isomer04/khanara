import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgOptimizedImage } from '@angular/common';
import { finalize } from 'rxjs';
import { CookService } from '../../../core/services/cook-service';
import { CartService } from '../../../core/services/cart-service';
import { AccountService } from '../../../core/services/account-service';
import { ToastService } from '../../../core/services/toast-service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog-service';
import { CookProfile, CuisineTagLabels } from '../../../types/cook-profile';
import { Dish, DietaryTagLabels } from '../../../types/dish';
import { CurrencyPipe } from '@angular/common';
import { CookReviews } from '../../reviews/cook-reviews/cook-reviews';
import { ngSrcFor } from '../../../core/services/image-url';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-cook-detail',
  imports: [CurrencyPipe, RouterLink, CookReviews, NgOptimizedImage],
  templateUrl: './cook-detail.html',
})
export class CookDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cookService = inject(CookService);
  protected cartService = inject(CartService);
  private accountService = inject(AccountService);
  private toast = inject(ToastService);
  private confirmDialog = inject(ConfirmDialogService);

  cook = signal<CookProfile | null>(null);
  loading = signal(false);
  protected dietaryTagLabels = DietaryTagLabels;

  get isLoggedIn() {
    return !!this.accountService.currentUser();
  }

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.loading.set(true);
    this.cookService.getCook(id).pipe(
      finalize(() => this.loading.set(false))
    ).subscribe({
      next: cook => this.cook.set(cook),
    });
  }

  async addToCart(dish: Dish) {
    if (!this.isLoggedIn) {
      this.toast.info('Log in to start an order');
      this.router.navigate(['/'], { queryParams: { login: 1, returnUrl: this.router.url } });
      return;
    }
    const cook = this.cook();
    if (!cook) return;

    const prevCook = this.cartService.cookProfileId();
    if (prevCook !== null && prevCook !== cook.id && this.cartService.itemCount() > 0) {
      const ok = await this.confirmDialog.confirm(
        'Your cart has dishes from another kitchen. Clear it and start a new order here?');
      if (!ok) return;
    }

    this.cartService.addItem(cook.id, {
      dishId: dish.id,
      dishName: dish.name,
      price: dish.price,
      quantity: 1,
    });
    this.toast.success(`${dish.name} added to cart`);
  }

  getCuisineLabel(tag: number) {
    return CuisineTagLabels[tag as keyof typeof CuisineTagLabels];
  }

  hasFlag(tags: number, flag: number) {
    return (tags & flag) === flag;
  }

  getMainPhoto(dish: { photos: { url: string; isMain: boolean }[] }): string {
    const photo = dish.photos.find(p => p.isMain) ?? dish.photos[0];
    return ngSrcFor(photo?.url, '/dish-placeholder.png', environment.apiUrl);
  }

  getKitchenPhoto(cook: CookProfile): string {
    return ngSrcFor(cook.kitchenPhotoUrl, '/kitchen-placeholder.png', environment.apiUrl);
  }
}
