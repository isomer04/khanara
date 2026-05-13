import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgOptimizedImage } from '@angular/common';
import { finalize } from 'rxjs';
import { FavoritesService } from '../../core/services/favorites-service';
import { FavoriteDto } from '../../types/favorite';
import { FavoriteButton } from '../../shared/favorite-button/favorite-button';
import { Paginator } from '../../shared/paginator/paginator';
import { Pagination } from '../../types/pagination';
import { ngSrcFor } from '../../core/services/image-url';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-favorites',
  imports: [RouterLink, FavoriteButton, Paginator, NgOptimizedImage],
  templateUrl: './favorites.html',
})
export class Favorites implements OnInit {
  private favoritesService = inject(FavoritesService);

  protected favorites = signal<FavoriteDto[]>([]);
  protected loading = signal(false);
  protected pagination = signal<Pagination | null>(null);
  protected pageNumber = signal(1);
  protected pageSize = 10;

  ngOnInit() {
    this.loadFavorites();
  }

  loadFavorites() {
    this.loading.set(true);
    this.favoritesService.getFavorites(this.pageNumber(), this.pageSize).pipe(
      finalize(() => this.loading.set(false))
    ).subscribe({
      next: result => {
        this.favorites.set(result.items);
        this.pagination.set(result.metadata);
      },
    });
  }

  onPageChange(event: { pageNumber: number, pageSize: number }) {
    this.pageNumber.set(event.pageNumber);
    if (event.pageSize) this.pageSize = event.pageSize;
    this.loadFavorites();
  }

  getPhoto(fav: FavoriteDto): string {
    return ngSrcFor(fav.kitchenPhotoUrl, '/kitchen-placeholder.png', environment.apiUrl);
  }
}
