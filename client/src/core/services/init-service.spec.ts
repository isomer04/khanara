import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';
import { InitService } from './init-service';
import { AccountService } from './account-service';
import { buildUser } from '../../testing/test-data-builders';

describe('InitService', () => {
  let service: InitService;
  let mockAccountService: any;

  beforeEach(() => {
    mockAccountService = {
      refreshToken: vi.fn(),
      setCurrentUser: vi.fn(),
      startTokenRefreshInterval: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        InitService,
        { provide: AccountService, useValue: mockAccountService },
      ],
    });
    service = TestBed.inject(InitService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should restore user session when refresh token succeeds', async () => {
    const mockUser = buildUser({ displayName: 'testuser' });
    mockAccountService.refreshToken.mockReturnValue(of(mockUser));

    const result = await firstValueFrom(service.init());

    expect(result).toEqual(mockUser);
    expect(mockAccountService.setCurrentUser).toHaveBeenCalledWith(mockUser);
    expect(mockAccountService.startTokenRefreshInterval).toHaveBeenCalled();
  });

  it('should handle no user session gracefully when refresh token returns null', async () => {
    mockAccountService.refreshToken.mockReturnValue(of(null));

    const result = await firstValueFrom(service.init());

    expect(result).toBeNull();
    expect(mockAccountService.setCurrentUser).not.toHaveBeenCalled();
    expect(mockAccountService.startTokenRefreshInterval).not.toHaveBeenCalled();
  });

  it('should handle refresh token failure gracefully without throwing', async () => {
    mockAccountService.refreshToken.mockReturnValue(
      throwError(() => ({ status: 401, message: 'Unauthorized' }))
    );

    const result = await firstValueFrom(service.init());

    expect(result).toBeNull();
    expect(mockAccountService.setCurrentUser).not.toHaveBeenCalled();
    expect(mockAccountService.startTokenRefreshInterval).not.toHaveBeenCalled();
  });
});
