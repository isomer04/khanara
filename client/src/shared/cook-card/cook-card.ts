import { Component, input, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgOptimizedImage } from '@angular/common';
import { FavoriteButton } from '../favorite-button/favorite-button';
import { DiscoveryCookDto } from '../../types/favorite';
import { CuisineTagLabels } from '../../types/cook-profile';
import { ngSrcFor } from '../../core/services/image-url';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-cook-card',
  imports: [RouterLink, FavoriteButton, NgOptimizedImage],
  templateUrl: './cook-card.html',
})
export class CookCard {
  cook = input.required<DiscoveryCookDto>();

  /** Show the star rating row (Popular section). Hidden in New section. */
  showRating = input(false);

  /** Show the "New" badge (New on Khanara section). */
  showNewBadge = input(false);

  /** Set fetchpriority=high on the image (first 4 LCP cards). */
  priority = input(false);

  protected cuisineLabels = computed(() =>
    this.cook().cuisineTags
      .map(t => CuisineTagLabels[t])
      .filter(Boolean)
      .slice(0, 2)
  );

  protected photoSrc = computed(() =>
    ngSrcFor(this.cook().kitchenPhotoUrl, '/kitchen-placeholder.png', environment.apiUrl)
  );
}
