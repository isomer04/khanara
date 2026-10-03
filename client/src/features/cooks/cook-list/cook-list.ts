import { Component, computed, DestroyRef, inject, OnInit, signal, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { NgOptimizedImage } from '@angular/common';
import { CookService } from '../../../core/services/cook-service';
import { CookProfile, CuisineTag, CuisineTagLabels } from '../../../types/cook-profile';
import { FavoriteButton } from '../../../shared/favorite-button/favorite-button';
import { ngSrcFor } from '../../../core/services/image-url';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-cook-list',
  imports: [RouterLink, FavoriteButton, FormsModule, NgOptimizedImage],
  templateUrl: './cook-list.html',
})
export class CookList implements OnInit, AfterViewInit {
  private cookService = inject(CookService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  @ViewChild('filterContainer') filterContainer!: ElementRef<HTMLDivElement>;

  protected cooks = signal<CookProfile[]>([]);
  protected loading = signal(false);
  protected cuisineTags = Object.entries(CuisineTagLabels).map(([key, label]) => ({
    value: Number(key) as CuisineTag,
    label,
  }));
  protected selectedCuisine = signal<number | undefined>(undefined);
  protected zipCode = signal<string>('');
  // The zip the current results are filtered by (zipCode is the input's live value)
  protected activeZip = signal<string>('');
  protected zipError = signal<string | null>(null);

  protected resultsLabel = computed(() => {
    const n = this.cooks().length;
    const cooks = n === 1 ? '1 cook' : `${n} cooks`;
    const zip = this.activeZip();
    return zip ? `${cooks} delivering to ${zip}` : `${cooks} available`;
  });
  
  // Arrow visibility signals
  protected showLeftArrow = signal(false);
  protected showRightArrow = signal(false);

  ngOnInit() {
    // Filters live in the URL so they survive reload/back and can be shared
    // (the home page's cuisine chips link to /cooks?cuisine=N).
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      // Number('') is 0 (Bengali), so an empty ?cuisine= must count as unset
      const cuisineParam = params.get('cuisine');
      const cuisine = Number(cuisineParam);
      this.selectedCuisine.set(
        cuisineParam && cuisine in CuisineTagLabels ? cuisine : undefined);

      const zip = params.get('zip') ?? '';
      this.activeZip.set(/^\d{5}$/.test(zip) ? zip : '');
      this.zipCode.set(this.activeZip());

      this.loadCooks();
    });
  }

  ngAfterViewInit() {
    // Check scroll position after view initializes
    setTimeout(() => this.updateArrowVisibility(), 100);
  }

  loadCooks() {
    this.loading.set(true);
    this.cookService.getCooks(1, 12, this.selectedCuisine(), this.activeZip()).pipe(
      finalize(() => this.loading.set(false))
    ).subscribe({
      next: result => this.cooks.set(result.items),
      error: () => {},
    });
  }

  onCuisineChange(value: string) {
    this.updateFilters({ cuisine: value === '' ? null : Number(value) });
  }

  onZipCodeChange() {
    const zip = this.zipCode().trim();
    if (zip && !/^\d{5}$/.test(zip)) {
      this.zipError.set('Enter a 5-digit zip code');
      return;
    }
    this.zipError.set(null);
    this.updateFilters({ zip: zip || null });
  }

  private updateFilters(queryParams: { cuisine?: number | null; zip?: string | null }) {
    this.router.navigate([], { relativeTo: this.route, queryParams, queryParamsHandling: 'merge' });
  }

  scrollLeft() {
    if (this.filterContainer) {
      const container = this.filterContainer.nativeElement;
      container.scrollBy({ left: -300, behavior: 'smooth' });
    }
  }

  scrollRight() {
    if (this.filterContainer) {
      const container = this.filterContainer.nativeElement;
      container.scrollBy({ left: 300, behavior: 'smooth' });
    }
  }

  onScroll() {
    this.updateArrowVisibility();
  }

  private updateArrowVisibility() {
    if (!this.filterContainer) return;

    const container = this.filterContainer.nativeElement;
    const scrollLeft = container.scrollLeft;
    const scrollWidth = container.scrollWidth;
    const clientWidth = container.clientWidth;

    // Show left arrow if not at the start
    this.showLeftArrow.set(scrollLeft > 10);

    // Show right arrow if not at the end
    this.showRightArrow.set(scrollLeft < scrollWidth - clientWidth - 10);
  }

  getMainPhoto(cook: CookProfile): string {
    return ngSrcFor(cook.kitchenPhotoUrl, '/kitchen-placeholder.png', environment.apiUrl);
  }

  getCuisineLabel(tag: CuisineTag) {
    return CuisineTagLabels[tag];
  }
}
