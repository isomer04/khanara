import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { CookReviews } from './cook-reviews';
import { ReviewService } from '../../../core/services/review-service';
import { buildReview, buildPaginatedResult } from '../../../testing/test-data-builders';

describe('CookReviews', () => {
  let component: CookReviews;
  let fixture: ComponentFixture<CookReviews>;
  let mockReviewService: any;

  beforeEach(async () => {
    const mockReviews = [
      buildReview({ id: 1, rating: 5, comment: 'Excellent!', authorDisplayName: 'John' }),
      buildReview({ id: 2, rating: 4, comment: 'Very good', authorDisplayName: 'Jane' }),
      buildReview({ id: 3, rating: 5, comment: 'Amazing food', authorDisplayName: 'Bob' }),
    ];

    mockReviewService = {
      getReviewsForCook: vi.fn().mockImplementation((cookId, page, pageSize) => {
        if (page === 1) {
          return of({
            items: mockReviews,
            metadata: { currentPage: 1, pageSize: 5, totalCount: 10, totalPages: 2 },
          });
        }
        return of({
          items: [],
          metadata: { currentPage: page, pageSize: 5, totalCount: 10, totalPages: 2 },
        });
      }),
    };

    await TestBed.configureTestingModule({
      imports: [CookReviews],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ReviewService, useValue: mockReviewService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CookReviews);
    component = fixture.componentInstance;
    component.cookId = 1;
    component.averageRating = 4.5;
    component.reviewCount = 10;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Initialization', () => {
    it('should load reviews on init', async () => {
      fixture.detectChanges();
      await fixture.whenStable();

      expect(mockReviewService.getReviewsForCook).toHaveBeenCalledWith(1, 1, 5);
      expect(component.reviews().length).toBe(3);
    });

    it('should set loading to false after reviews load', async () => {
      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.loading()).toBe(false);
    });

    it('should set meta data from response', async () => {
      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.meta()).toBeTruthy();
      expect(component.meta()?.currentPage).toBe(1);
      expect(component.meta()?.totalPages).toBe(2);
    });

    it('should handle error when loading reviews fails', async () => {
      mockReviewService.getReviewsForCook.mockReturnValue(
        throwError(() => new Error('Load failed'))
      );

      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.loading()).toBe(false);
      expect(component.reviews().length).toBe(0);
    });
  });

  describe('Display', () => {
    beforeEach(async () => {
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it('should display average rating', () => {
      const compiled = fixture.nativeElement;
      expect(compiled.textContent).toContain('4.5');
    });

    it('should display review count', () => {
      const compiled = fixture.nativeElement;
      expect(compiled.textContent).toContain('10 reviews');
    });

    it('should display all loaded reviews', () => {
      const compiled = fixture.nativeElement;
      expect(compiled.textContent).toContain('John');
      expect(compiled.textContent).toContain('Jane');
      expect(compiled.textContent).toContain('Bob');
    });

    it('should display review comments', () => {
      const compiled = fixture.nativeElement;
      expect(compiled.textContent).toContain('Excellent!');
      expect(compiled.textContent).toContain('Very good');
      expect(compiled.textContent).toContain('Amazing food');
    });

    it('should display "No reviews yet" when review count is 0', async () => {
      component.reviewCount = 0;
      component.reviews.set([]);
      fixture.detectChanges();
      await fixture.whenStable();

      const compiled = fixture.nativeElement;
      expect(compiled.textContent).toContain('No reviews yet');
    });
  });

  describe('Load More', () => {
    beforeEach(async () => {
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it('should load more reviews when button is clicked', async () => {
      const moreReviews = [
        buildReview({ id: 4, rating: 3, comment: 'Good', authorDisplayName: 'Alice' }),
      ];
      mockReviewService.getReviewsForCook.mockReturnValue(
        of({
          items: moreReviews,
          metadata: { currentPage: 2, pageSize: 5, totalCount: 10, totalPages: 2 },
        })
      );

      component.loadMore();
      await fixture.whenStable();

      expect(component.reviews().length).toBe(4);
    });

    it('should append new reviews to existing list', async () => {
      const initialReviews = component.reviews();
      const moreReviews = [
        buildReview({ id: 4, rating: 3, comment: 'Good', authorDisplayName: 'Alice' }),
      ];
      mockReviewService.getReviewsForCook.mockReturnValue(
        of({
          items: moreReviews,
          metadata: { currentPage: 2, pageSize: 5, totalCount: 10, totalPages: 2 },
        })
      );

      component.loadMore();
      await fixture.whenStable();

      expect(component.reviews()[0]).toBe(initialReviews[0]);
      expect(component.reviews()[3].authorDisplayName).toBe('Alice');
    });

    it('should set loadingMore to false after load completes', async () => {
      component.loadMore();
      await fixture.whenStable();

      expect(component.loadingMore()).toBe(false);
    });

    it('should not load more if already on last page', () => {
      component.meta.set({ currentPage: 2, totalPages: 2, pageSize: 5, totalCount: 10 });
      mockReviewService.getReviewsForCook.mockClear();

      component.loadMore();

      expect(mockReviewService.getReviewsForCook).not.toHaveBeenCalled();
    });

    it('should handle error when loading more fails', async () => {
      mockReviewService.getReviewsForCook.mockReturnValue(
        throwError(() => new Error('Load failed'))
      );

      component.loadMore();
      await fixture.whenStable();

      expect(component.loadingMore()).toBe(false);
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

  describe('hasMore getter', () => {
    it('should return true when there are more pages', () => {
      component.meta.set({ currentPage: 1, totalPages: 2, pageSize: 5, totalCount: 10 });
      expect(component.hasMore).toBe(true);
    });

    it('should return false when on last page', () => {
      component.meta.set({ currentPage: 2, totalPages: 2, pageSize: 5, totalCount: 10 });
      expect(component.hasMore).toBe(false);
    });

    it('should return false when meta is null', () => {
      component.meta.set(null);
      expect(component.hasMore).toBe(false);
    });
  });
});
