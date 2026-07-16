import { Component, inject, Input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ReviewService } from '../../../core/services/review-service';
import { ToastService } from '../../../core/services/toast-service';
import { Review } from '../../../types/review';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-review-card',
  imports: [FormsModule, DatePipe],
  templateUrl: './review-card.html',
})
export class ReviewCard implements OnInit {
  @Input({ required: true }) orderId!: number;
  @Input() isEater = false;
  @Input() isCook = false;

  private reviewService = inject(ReviewService);
  private toast = inject(ToastService);

  protected review = signal<Review | null>(null);
  protected loading = signal(true);
  protected submitting = signal(false);
  protected selectedRating = signal(0);
  protected hoverRating = signal(0);
  protected comment = signal('');
  protected replyText = signal('');
  protected submittingReply = signal(false);
  protected showReplyForm = signal(false);

  ngOnInit() {
    this.reviewService.getReviewByOrder(this.orderId).subscribe({
      next: r => this.review.set(r),
      error: (err: HttpErrorResponse) => {
        if (err.status !== 404) this.toast.error('Failed to load review');
        this.loading.set(false);
      },
      complete: () => this.loading.set(false),
    });
  }

  setHover(n: number) { this.hoverRating.set(n); }
  clearHover() { this.hoverRating.set(0); }

  selectRating(n: number) { this.selectedRating.set(n); }

  starClass(n: number): string {
    const active = this.hoverRating() || this.selectedRating();
    return n <= active ? 'text-yellow-400' : 'text-gray-300';
  }

  filledStars(rating: number): number[] {
    return Array.from({ length: rating }, (_, i) => i + 1);
  }

  emptyStars(rating: number): number[] {
    return Array.from({ length: 5 - rating }, (_, i) => i + 1);
  }

  submitReview() {
    if (this.selectedRating() === 0) return;
    this.submitting.set(true);
    this.reviewService.createReview({
      orderId: this.orderId,
      rating: this.selectedRating(),
      comment: this.comment().trim() || undefined,
    }).subscribe({
      next: r => {
        this.review.set(r);
        this.toast.success('Review submitted!');
      },
      error: () => this.toast.error('Failed to submit review'),
      complete: () => this.submitting.set(false),
    });
  }

  submitReply() {
    const reply = this.replyText().trim();
    const r = this.review();
    if (!reply || !r) return;
    this.submittingReply.set(true);
    this.reviewService.addReply(r.id, { reply }).subscribe({
      next: updated => {
        this.review.set(updated);
        this.showReplyForm.set(false);
        this.replyText.set('');
        this.toast.success('Reply posted!');
      },
      error: () => this.toast.error('Failed to post reply'),
      complete: () => this.submittingReply.set(false),
    });
  }
}
