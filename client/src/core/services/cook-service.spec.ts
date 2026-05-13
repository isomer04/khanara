import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CookService } from './cook-service';
import { environment } from '../../environments/environment';

describe('CookService', () => {
  let service: CookService;
  let http: HttpTestingController;
  const base = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CookService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('myCookProfile signal starts null', () => {
    expect(service.myCookProfile()).toBeNull();
  });

  it('getCooks sends correct page params', () => {
    service.getCooks(2, 6).subscribe();
    const req = http.expectOne(r => r.url.includes('cooks'));
    expect(req.request.params.get('pageNumber')).toBe('2');
    expect(req.request.params.get('pageSize')).toBe('6');
    req.flush({ items: [], totalCount: 0 });
  });

  it('getCooks includes cuisine filter when provided', () => {
    service.getCooks(1, 12, 1).subscribe();
    const req = http.expectOne(r => r.url.includes('cooks'));
    expect(req.request.params.get('cuisine')).toBe('1');
    req.flush({ items: [], totalCount: 0 });
  });

  it('getCook fetches single profile', () => {
    service.getCook(5).subscribe();
    const req = http.expectOne(base + 'cooks/5');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('loadMyCookProfile updates myCookProfile signal', () => {
    const profile = { id: 1, kitchenName: 'Test Kitchen' } as any;
    service.loadMyCookProfile().subscribe();
    const req = http.expectOne(base + 'cooks/me');
    req.flush(profile);
    expect(service.myCookProfile()).toEqual(profile);
  });

  it('createCookProfile posts and updates signal', () => {
    const dto = { kitchenName: 'New Kitchen', bio: '', cuisineTags: [], serviceZipCodes: [] };
    const created = { id: 2, ...dto } as any;
    service.createCookProfile(dto).subscribe();
    const req = http.expectOne(base + 'cooks');
    expect(req.request.method).toBe('POST');
    req.flush(created);
    expect(service.myCookProfile()).toEqual(created);
  });
});
