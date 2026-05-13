import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AccountService } from './account-service';
import { User } from '../../types/user';
import { environment } from '../../environments/environment';

const base = environment.apiUrl;

const jwtPayload = (role: string | string[]) => btoa(JSON.stringify({ role }));
const makeUser = (role: string | string[] = 'Eater'): User => ({
  id: 'u1',
  displayName: 'Test User',
  email: 'test@khanara.dev',
  token: `hdr.${jwtPayload(role)}.sig`,
  roles: [],
});

describe('AccountService', () => {
  let service: AccountService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AccountService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('currentUser starts as null', () => {
    expect(service.currentUser()).toBeNull();
  });

  it('login posts to account/login with credentials and withCredentials', () => {
    const creds = { email: 'test@khanara.dev', password: 'K@h4n@r@Eat3r2025!' };
    service.login(creds).subscribe();

    const req = http.expectOne(base + 'account/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(creds);
    expect(req.request.withCredentials).toBe(true);
    req.flush(makeUser());
    http.expectOne(r => r.url.includes('favorites/ids')).flush([]);
  });

  it('login sets currentUser with parsed roles', () => {
    service.login({ email: 'x@x.com', password: 'pass' }).subscribe();
    http.expectOne(base + 'account/login').flush(makeUser('Cook'));
    http.expectOne(r => r.url.includes('favorites/ids')).flush([]);

    expect(service.currentUser()?.roles).toContain('Cook');
  });

  it('register posts to account/register', () => {
    const creds = { email: 'new@khanara.dev', password: 'K@h4n@r@N3w2025!' } as any;
    service.register(creds).subscribe();

    const req = http.expectOne(base + 'account/register');
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    req.flush(makeUser());
    http.expectOne(r => r.url.includes('favorites/ids')).flush([]);
  });

  it('register sets currentUser on success', () => {
    service.register({ email: 'e@e.com' } as any).subscribe();
    http.expectOne(base + 'account/register').flush(makeUser(['Eater']));
    http.expectOne(r => r.url.includes('favorites/ids')).flush([]);

    expect(service.currentUser()).not.toBeNull();
  });

  it('setCurrentUser parses a single role from token', () => {
    service.setCurrentUser(makeUser('Admin'));
    http.expectOne(r => r.url.includes('favorites/ids')).flush([]);

    expect(service.currentUser()?.roles).toEqual(['Admin']);
  });

  it('setCurrentUser parses multiple roles from token', () => {
    service.setCurrentUser(makeUser(['Cook', 'Admin']));
    http.expectOne(r => r.url.includes('favorites/ids')).flush([]);

    expect(service.currentUser()?.roles).toContain('Cook');
    expect(service.currentUser()?.roles).toContain('Admin');
  });

  it('setCurrentUser returns empty roles for malformed token', () => {
    const badUser: User = { ...makeUser(), token: 'not.a.valid.jwt' };
    service.setCurrentUser(badUser);
    http.expectOne(r => r.url.includes('favorites/ids')).flush([]);

    expect(service.currentUser()?.roles).toEqual([]);
  });

  it('setCurrentUser returns empty roles when token has no role claim', () => {
    const noRolePayload = btoa(JSON.stringify({ sub: 'user1' }));
    const user: User = { ...makeUser(), token: `hdr.${noRolePayload}.sig` };
    service.setCurrentUser(user);
    http.expectOne(r => r.url.includes('favorites/ids')).flush([]);

    expect(service.currentUser()?.roles).toEqual([]);
  });

  it('logout posts to account/logout and clears currentUser', () => {
    service.currentUser.set(makeUser());

    service.logout();
    const req = http.expectOne(base + 'account/logout');
    expect(req.request.method).toBe('POST');
    req.flush({});

    expect(service.currentUser()).toBeNull();
  });

  it('refreshToken posts to account/refresh-token', () => {
    service.refreshToken().subscribe();

    const req = http.expectOne(base + 'account/refresh-token');
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    req.flush(makeUser());
  });
});
