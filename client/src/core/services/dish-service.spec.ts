import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DishService } from './dish-service';
import { environment } from '../../environments/environment';

describe('DishService', () => {
  let service: DishService;
  let http: HttpTestingController;
  const base = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(DishService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('getDishes sends page params', () => {
    service.getDishes(1, 12).subscribe();
    const req = http.expectOne(r => r.url.endsWith(base + 'dishes'));
    expect(req.request.params.get('pageNumber')).toBe('1');
    expect(req.request.params.get('pageSize')).toBe('12');
    req.flush({ items: [], totalCount: 0 });
  });

  it('getDishes includes dietary filter when provided', () => {
    service.getDishes(1, 12, undefined, 2).subscribe();
    const req = http.expectOne(r => r.url.endsWith(base + 'dishes'));
    expect(req.request.params.get('dietary')).toBe('2');
    req.flush({ items: [], totalCount: 0 });
  });

  it('getDish fetches by id', () => {
    service.getDish(9).subscribe();
    const req = http.expectOne(r => r.url.endsWith(base + 'dishes/9'));
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('createDish posts dto', () => {
    const dto = { name: 'Biryani', price: 15, cuisineTag: 0, portionsPerBatch: 10 } as any;
    service.createDish(dto).subscribe();
    const req = http.expectOne(r => r.url.endsWith(base + 'dishes'));
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('updateDish sends PUT to correct endpoint', () => {
    service.updateDish(3, { name: 'Updated' } as any).subscribe();
    const req = http.expectOne(r => r.url.endsWith(base + 'dishes/3'));
    expect(req.request.method).toBe('PUT');
    req.flush({});
  });

  it('deleteDish sends DELETE', () => {
    service.deleteDish(4).subscribe();
    const req = http.expectOne(r => r.url.endsWith(base + 'dishes/4'));
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('deletePhoto sends DELETE to photo endpoint', () => {
    service.deletePhoto(5, 11).subscribe();
    const req = http.expectOne(r => r.url.endsWith(base + 'dishes/5/photos/11'));
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
