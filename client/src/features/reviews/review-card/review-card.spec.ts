import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ReviewCard } from './review-card';
import { ReviewService } from '../../../core/services/review-service';
import { ToastService } from '../../../core/services/toast-service';
import { buildReview } from '../../../testing/test-data-builders';

describe('ReviewCard', () => {
  let component: ReviewCard;
  let fixture: ComponentFixture<ReviewCard>;
  let mockReviewService: any;
  let mockToastService: any;

  beforeEach(async () => {
    mockReviewService = {
      getReviewByOrder: vi.fn().mockReturnValue(of(null)),
      createReview: vi.fn().mockReturnValue(of(buildReview({ id: 1, rating: 5 }))),
      addReply: vi.fn().mockReturnValue(of(buildReview({ id: 1, cookReply: 'Thank you!' }))),
    };

    mockToastService = {
      success: vi.fn(),
      error: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ReviewCard],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ReviewService, useValue: mockReviewService },
        { provide: ToastService, useValue: mockToastService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ReviewCard);
    component = fixture.componentInstance;
    component.orderId = 1;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Initialization', () => {
    it('should load review on init', async () => {
      fixture.detectChanges();
      await fixture.whenStable();

      expect(mockReviewService.getReviewByOrder).toHaveBeenCalledWith(1);
    });

    it('should set loading to false after review loads', async () => {
      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.loading()).toBe(false);
    });

    it('should handle 404 error gracefully', async () => {
      const error = new HttpErrorResponse({ status: 404 });
      mockReviewService.getReviewByOrder.mockReturnValue(throwError(() => error));

      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.loading()).toBe(false);
      expect(mockToastService.error).not.toHaveBeenCalled();
    });

    it('should show error toast for non-404 errors', async () => {
      const error = new HttpErrorResponse({ status: 500 });
      mockReviewService.getReviewByOrder.mockReturnValue(throwError(() => error));

      fixture.detectChanges();
      await fixture.whenStable();

      expect(mockToastService.error).toHaveBeenCalledWith('Failed to load review');
    });
  });

  describe('Star Rating Selection (Eater)', () => {
    beforeEach(async () => {
      component.isEater = true;
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it('should set hover rating on mouse enter', () => {
      component.setHover(4);
      expect(component.hoverRating()).toBe(4);
    });

    it('should clear hover rating on mouse leave', () => {
      component.setHover(4);
      component.clearHover();
      expect(component.hoverRating()).toBe(0);
    });

    it('should set selected rating on click', () => {
      component.selectRating(5);
      expect(component.selectedRating()).toBe(5);
    });

    it('should return correct star class for hovered star', () => {
      component.setHover(3);
      expect(component.starClass(2)).toBe('text-yellow-400');
      expect(component.starClass(4)).toBe('text-gray-300');
    });

    it('should return correct star class for selected star', () => {
      component.selectRating(4);
      expect(component.starClass(3)).toBe('text-yellow-400');
      expect(component.starClass(5)).toBe('text-gray-300');
    });

    it('should prioritize hover over selection for star class', () => {
      component.selectRating(3);
      component.setHover(5);
      expect(component.starClass(4)).toBe('text-yellow-400');
    });
  });

  describe('Submit Review (Eater)', () => {
    beforeEach(async () => {
      component.isEater = true;
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it('should not submit if rating is 0', () => {
      component.selectedRating.set(0);
      component.submitReview();

      expect(mockReviewService.createReview).not.toHaveBeenCalled();
    });

    it('should submit review with rating and comment', async () => {
      component.selectedRating.set(5);
      component.comment.set('Great food!');

      component.submitReview();
      await fixture.whenStable();

      expect(mockReviewService.createReview).toHaveBeenCalledWith({
        orderId: 1,
        rating: 5,
        comment: 'Great food!',
      });
    });

    it('should submit review with rating only if comment is empty', async () => {
      component.selectedRating.set(4);
      component.comment.set('');

      component.submitReview();
      await fixture.whenStable();

      expect(mockReviewService.createReview).toHaveBeenCalledWith({
        orderId: 1,
        rating: 4,
        comment: undefined,
      });
    });

    it('should set submitting to false after submission completes', async () => {
      component.selectedRating.set(5);
      component.submitReview();
      await fixture.whenStable();

      expect(component.submitting()).toBe(false);
    });

    it('should update review after successful submission', async () => {
      component.selectedRating.set(5);
      component.submitReview();
      await fixture.whenStable();

      expect(component.review()).toBeTruthy();
      expect(component.review()?.rating).toBe(5);
    });

    it('should show success toast after submission', async () => {
      component.selectedRating.set(5);
      component.submitReview();
      await fixture.whenStable();

      expect(mockToastService.success).toHaveBeenCalledWith('Review submitted!');
    });

    it('should show error toast when submission fails', async () => {
      mockReviewService.createReview.mockReturnValue(
        throwError(() => new Error('Submit failed'))
      );
      component.selectedRating.set(5);

      component.submitReview();
      await fixture.whenStable();

      expect(mockToastService.error).toHaveBeenCalledWith('Failed to submit review');
    });
  });

  describe('Cook Reply', () => {
    beforeEach(async () => {
      component.isCook = true;
      mockReviewService.getReviewByOrder.mockReturnValue(
        of(buildReview({ id: 1, rating: 5, comment: 'Great!', cookReply: null }))
      );
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it('should show reply form when reply button is clicked', () => {
      component.showReplyForm.set(true);
      expect(component.showReplyForm()).toBe(true);
    });

    it('should hide reply form when cancel is clicked', () => {
      component.showReplyForm.set(true);
      component.showReplyForm.set(false);
      expect(component.showReplyForm()).toBe(false);
    });

    it('should not submit reply if text is empty', () => {
      component.replyText.set('');
      component.submitReply();

      expect(mockReviewService.addReply).not.toHaveBeenCalled();
    });

    it('should not submit reply if review is null', () => {
      component.review.set(null);
      component.replyText.set('Thank you!');
      component.submitReply();

      expect(mockReviewService.addReply).not.toHaveBeenCalled();
    });

    it('should submit reply with correct parameters', async () => {
      component.replyText.set('Thank you for your feedback!');

      component.submitReply();
      await fixture.whenStable();

      expect(mockReviewService.addReply).toHaveBeenCalledWith(1, {
        reply: 'Thank you for your feedback!',
      });
    });

    it('should update review after successful reply', async () => {
      component.replyText.set('Thank you!');

      component.submitReply();
      await fixture.whenStable();

      expect(component.review()?.cookReply).toBe('Thank you!');
    });

    it('should hide reply form after successful submission', async () => {
      component.showReplyForm.set(true);
      component.replyText.set('Thank you!');

      component.submitReply();
      await fixture.whenStable();

      expect(component.showReplyForm()).toBe(false);
    });

    it('should clear reply text after successful submission', async () => {
      component.replyText.set('Thank you!');

      component.submitReply();
      await fixture.whenStable();

      expect(component.replyText()).toBe('');
    });

    it('should show success toast after reply is posted', async () => {
      component.replyText.set('Thank you!');

      component.submitReply();
      await fixture.whenStable();

      expect(mockToastService.success).toHaveBeenCalledWith('Reply posted!');
    });

    it('should show error toast when reply fails', async () => {
      mockReviewService.addReply.mockReturnValue(
        throwError(() => new Error('Reply failed'))
      );
      component.replyText.set('Thank you!');

      component.submitReply();
      await fixture.whenStable();

      expect(mockToastService.error).toHaveBeenCalledWith('Failed to post reply');
    });
  });

  describe('Star Display', () => {
    it('should return correct number of filled stars', () => {
      expect(component.filledStars(5).length).toBe(5);
      expect(component.filledStars(3).length).toBe(3);
      expect(component.filledStars(0).length).toBe(0);
    });

    it('should return correct number of empty stars', () => {
      expect(component.emptyStars(5).length).toBe(0);
      expect(component.emptyStars(3).length).toBe(2);
      expect(component.emptyStars(0).length).toBe(5);
    });
  });
});
