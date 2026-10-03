import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CurrencyPipe, NgOptimizedImage } from '@angular/common';
import { finalize } from 'rxjs';
import { CookService } from '../../../core/services/cook-service';
import { DishService } from '../../../core/services/dish-service';
import { ToastService } from '../../../core/services/toast-service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog-service';
import { CookProfile } from '../../../types/cook-profile';
import { Dish } from '../../../types/dish';
import { ngSrcFor } from '../../../core/services/image-url';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-cook-dashboard',
  imports: [RouterLink, CurrencyPipe, NgOptimizedImage],
  templateUrl: './cook-dashboard.html',
})
export class CookDashboard implements OnInit {
  private cookService = inject(CookService);
  private dishService = inject(DishService);
  private toast = inject(ToastService);
  private confirmDialog = inject(ConfirmDialogService);

  cookProfile = signal<CookProfile | null>(null);
  dishes = signal<Dish[]>([]);
  loading = signal(false);
  deletingId = signal<number | null>(null);

  ngOnInit() {
    this.loading.set(true);
    this.cookService.loadMyCookProfile().pipe(
      finalize(() => this.loading.set(false))
    ).subscribe({
      next: profile => {
        this.cookProfile.set(profile);
        this.dishes.set(profile.dishes);
      },
    });
  }

  getMainPhoto(dish: Dish): string {
    const photo = dish.photos.find(p => p.isMain) ?? dish.photos[0];
    return ngSrcFor(photo?.url, '/dish-placeholder.png', environment.apiUrl);
  }

  async deleteDish(dish: Dish) {
    if (!await this.confirmDialog.confirm(`Delete "${dish.name}"?`)) return;

    this.deletingId.set(dish.id);
    this.dishService.deleteDish(dish.id).pipe(
      finalize(() => this.deletingId.set(null))
    ).subscribe({
      next: () => {
        this.dishes.set(this.dishes().filter(d => d.id !== dish.id));
        this.toast.success('Dish removed');
      },
      error: () => this.toast.error('Failed to delete dish'),
    });
  }
}
