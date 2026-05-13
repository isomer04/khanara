import { Component, inject, OnInit, signal, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { RouterLink } from '@angular/router';
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

  @ViewChild('filterContainer') filterContainer!: ElementRef<HTMLDivElement>;

  protected cooks = signal<CookProfile[]>([]);
  protected loading = signal(false);
  protected cuisineTags = Object.entries(CuisineTagLabels).map(([key, label]) => ({
    value: Number(key) as CuisineTag,
    label,
  }));
  protected selectedCuisine = signal<number | undefined>(undefined);
  protected zipCode = signal<string>('');
  
  // Arrow visibility signals
  protected showLeftArrow = signal(false);
  protected showRightArrow = signal(false);

  ngOnInit() {
    this.loadCooks();
  }

  ngAfterViewInit() {
    // Check scroll position after view initializes
    setTimeout(() => this.updateArrowVisibility(), 100);
  }

  loadCooks() {
    this.loading.set(true);
    this.cookService.getCooks(1, 12, this.selectedCuisine(), this.zipCode()).subscribe({
      next: result => this.cooks.set(result.items),
      error: () => this.loading.set(false),
      complete: () => this.loading.set(false),
    });
  }

  onCuisineChange(value: string) {
    this.selectedCuisine.set(value === '' ? undefined : Number(value));
    this.loadCooks();
  }

  onZipCodeChange() {
    this.loadCooks();
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
