import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ReviewService } from './review-service';
import { environment } from '../../environments/environment';

describe('ReviewService', () => {
  let service: ReviewService;
  let http: HttpTestingController;
  const base = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ReviewService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('createReview posts to reviews endpoint', () => {
    const dto = { orderId: 1, rating: 5, comment: 'Excellent!' };
    service.createReview(dto as any).subscribe();
    const req = http.expectOne(base + 'reviews');
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('getReviewByOrder fetches from correct endpoint', () => {
    service.getReviewByOrder(7).subscribe();
    const req = http.expectOne(base + 'reviews/order/7');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('getReviewsForCook fetches paginated reviews', () => {
    service.getReviewsForCook(3, 2, 5).subscribe();
    const req = http.expectOne(r => r.url.includes('cooks/3/reviews'));
    expect(req.request.params.get('pageNumber')).toBe('2');
    expect(req.request.params.get('pageSize')).toBe('5');
    req.flush({ items: [], totalCount: 0 });
  });

  it('addReply posts to reply endpoint', () => {
    service.addReply(12, { reply: 'Thank you!' }).subscribe();
    const req = http.expectOne(base + 'reviews/12/reply');
    expect(req.request.method).toBe('POST');
    req.flush({});
  });
});
