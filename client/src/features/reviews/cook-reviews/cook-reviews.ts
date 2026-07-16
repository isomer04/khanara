import { Component, inject, Input, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ReviewService } from '../../../core/services/review-service';
import { Review } from '../../../types/review';
import { Pagination } from '../../../types/pagination';

@Component({
  selector: 'app-cook-reviews',
  imports: [DatePipe],
  templateUrl: './cook-reviews.html',
})
export class CookReviews implements OnInit {
  @Input({ required: true }) cookId!: number;
  @Input() averageRating = 0;
  @Input() reviewCount = 0;

  private reviewService = inject(ReviewService);

  protected reviews = signal<Review[]>([]);
  protected meta = signal<Pagination | null>(null);
  protected Math = Math;
  protected loading = signal(true);
  protected loadingMore = signal(false);

  ngOnInit() {
    this.reviewService.getReviewsForCook(this.cookId, 1, 5).subscribe({
      next: result => {
        this.reviews.set(result.items);
        this.meta.set(result.metadata);
      },
      error: () => this.loading.set(false),
      complete: () => this.loading.set(false),
    });
  }

  loadMore() {
    const m = this.meta();
    if (!m || m.currentPage >= m.totalPages) return;
    const nextPage = m.currentPage + 1;
    this.loadingMore.set(true);
    this.reviewService.getReviewsForCook(this.cookId, nextPage, 5).subscribe({
      next: result => {
        this.reviews.update(prev => [...prev, ...result.items]);
        this.meta.set(result.metadata);
      },
      error: () => this.loadingMore.set(false),
      complete: () => this.loadingMore.set(false),
    });
  }

  filledStars(rating: number): number[] {
    return Array.from({ length: rating }, (_, i) => i + 1);
  }

  emptyStars(rating: number): number[] {
    return Array.from({ length: 5 - rating }, (_, i) => i + 1);
  }

  get hasMore(): boolean {
    const m = this.meta();
    return !!m && m.currentPage < m.totalPages;
  }
}
