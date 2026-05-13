import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { Review, CreateReviewDto, AddReplyDto } from '../../types/review';
import { PaginatedResult } from '../../types/pagination';

@Injectable({ providedIn: 'root' })
export class ReviewService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiUrl;

  createReview(dto: CreateReviewDto) {
    return this.http.post<Review>(this.baseUrl + 'reviews', dto);
  }

  getReviewByOrder(orderId: number) {
    return this.http.get<Review>(this.baseUrl + `reviews/order/${orderId}`);
  }

  getReviewsForCook(cookId: number, pageNumber = 1, pageSize = 5) {
    const params = new HttpParams()
      .set('pageNumber', pageNumber)
      .set('pageSize', pageSize);
    return this.http.get<PaginatedResult<Review>>(this.baseUrl + `cooks/${cookId}/reviews`, { params });
  }

  addReply(reviewId: number, dto: AddReplyDto) {
    return this.http.post<Review>(this.baseUrl + `reviews/${reviewId}/reply`, dto);
  }
}
