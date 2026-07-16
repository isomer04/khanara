import { Component, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AccountService } from '../../core/services/account-service';
import { FavoritesService } from '../../core/services/favorites-service';

@Component({
  selector: 'app-favorite-button',
  templateUrl: './favorite-button.html',
})
export class FavoriteButton {
  cookId = input.required<number>();

  private accountService = inject(AccountService);
  private favoritesService = inject(FavoritesService);
  private router = inject(Router);

  protected pending = signal(false);

  get isFavorited() {
    return this.favoritesService.isFavorited(this.cookId());
  }

  toggle(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();

    if (!this.accountService.currentUser()) {
      this.router.navigateByUrl('/');
      return;
    }

    if (this.pending()) return;
    this.pending.set(true);

    const req$ = this.isFavorited
      ? this.favoritesService.removeFavorite(this.cookId())
      : this.favoritesService.addFavorite(this.cookId());

    req$.pipe(finalize(() => this.pending.set(false))).subscribe({
      error: (err) => console.error('Failed to toggle favorite', err)
    });
  }
}
