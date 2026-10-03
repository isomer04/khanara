import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { CookList } from './cook-list';
import { CookService } from '../../../core/services/cook-service';
import { buildCookProfile, buildPaginatedResult } from '../../../testing/test-data-builders';
import { CuisineTag } from '../../../types/cook-profile';
import { createMockCookService } from '../../../testing/mock-services';

describe('CookList', () => {
  let component: CookList;
  let fixture: ComponentFixture<CookList>;
  let mockCookService: ReturnType<typeof createMockCookService>;

  beforeEach(async () => {
    mockCookService = createMockCookService({
      getCooks: vi.fn().mockReturnValue(of(buildPaginatedResult([], 1, 12))),
    });

    await TestBed.configureTestingModule({
      imports: [CookList],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CookService, useValue: mockCookService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CookList);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('initialization', () => {
    it('should load cooks on init', () => {
      const mockCooks = [
        buildCookProfile({ id: 1, displayName: 'Chef Alice' }),
        buildCookProfile({ id: 2, displayName: 'Chef Bob' }),
      ];
      mockCookService.getCooks.mockReturnValue(of(buildPaginatedResult(mockCooks, 1, 12)));

      fixture.detectChanges();

      expect(mockCookService.getCooks).toHaveBeenCalledWith(1, 12, undefined, '');
      expect(component.cooks()).toEqual(mockCooks);
    });

    it('should set loading state during cook loading', () => {
      fixture.detectChanges();

      expect(component.loading()).toBe(false);
    });
  });

  describe('filtering', () => {
    it('should filter by cuisine when cuisine is selected', async () => {
      fixture.detectChanges();
      vi.mocked(mockCookService.getCooks).mockClear();

      component.onCuisineChange('1'); // CuisineTag.Indian = 1
      await fixture.whenStable();

      expect(component.selectedCuisine()).toBe(CuisineTag.Indian);
      expect(mockCookService.getCooks).toHaveBeenCalledWith(1, 12, CuisineTag.Indian, '');
      expect(TestBed.inject(Router).url).toBe('/?cuisine=1');
    });

    it('should clear cuisine filter when empty value is selected', async () => {
      await TestBed.inject(Router).navigateByUrl('/?cuisine=1');
      fixture.detectChanges();
      vi.mocked(mockCookService.getCooks).mockClear();

      component.onCuisineChange('');
      await fixture.whenStable();

      expect(component.selectedCuisine()).toBeUndefined();
      expect(mockCookService.getCooks).toHaveBeenCalledWith(1, 12, undefined, '');
    });

    it('should filter by zip code', async () => {
      fixture.detectChanges();
      vi.mocked(mockCookService.getCooks).mockClear();
      component.zipCode.set('12345');

      component.onZipCodeChange();
      await fixture.whenStable();

      expect(mockCookService.getCooks).toHaveBeenCalledWith(1, 12, undefined, '12345');
    });

    it('should reject a zip code that is not 5 digits', async () => {
      fixture.detectChanges();
      vi.mocked(mockCookService.getCooks).mockClear();
      component.zipCode.set('12ab');

      component.onZipCodeChange();
      await fixture.whenStable();

      expect(component.zipError()).toBe('Enter a 5-digit zip code');
      expect(mockCookService.getCooks).not.toHaveBeenCalled();
    });

    it('should restore both filters from the URL', async () => {
      await TestBed.inject(Router).navigateByUrl('/?cuisine=11&zip=90210');
      fixture.detectChanges();

      expect(component.selectedCuisine()).toBe(CuisineTag.Thai);
      expect(component.zipCode()).toBe('90210');
      expect(mockCookService.getCooks).toHaveBeenLastCalledWith(1, 12, CuisineTag.Thai, '90210');
    });

    it('should ignore invalid filter values in the URL', async () => {
      await TestBed.inject(Router).navigateByUrl('/?cuisine=999&zip=abc');
      fixture.detectChanges();

      expect(mockCookService.getCooks).toHaveBeenLastCalledWith(1, 12, undefined, '');
    });
  });

  describe('results label', () => {
    it('should use the singular for one cook', () => {
      mockCookService.getCooks.mockReturnValue(of(buildPaginatedResult([buildCookProfile()], 1, 12)));
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('1 cook available');
    });
  });

  describe('display', () => {
    it('should display cook list when cooks are loaded', () => {
      const mockCooks = [
        buildCookProfile({ id: 1, kitchenName: 'Chef Alice Kitchen' }),
        buildCookProfile({ id: 2, kitchenName: 'Chef Bob Kitchen' }),
      ];
      mockCookService.getCooks.mockReturnValue(of(buildPaginatedResult(mockCooks, 1, 12)));

      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Chef Alice Kitchen');
      expect(compiled.textContent).toContain('Chef Bob Kitchen');
    });

    it('should return main photo URL when available', () => {
      const cook = buildCookProfile({ kitchenPhotoUrl: 'https://example.com/kitchen.jpg' });

      const photoUrl = component.getMainPhoto(cook);

      expect(photoUrl).toBe('https://example.com/kitchen.jpg');
    });

    it('should return placeholder when no photo available', () => {
      const cook = buildCookProfile({ kitchenPhotoUrl: null });

      const photoUrl = component.getMainPhoto(cook);

      // ngSrcFor resolves placeholder against window.location.origin for NgOptimizedImage
      expect(photoUrl).toContain('kitchen-placeholder.png');
    });

    it('should get cuisine label for tag', () => {
      const label = component.getCuisineLabel(CuisineTag.Indian);

      expect(label).toBe('Indian');
    });
  });

  describe('error handling', () => {
    it('should handle error when loading cooks fails', () => {
      mockCookService.getCooks.mockReturnValue(throwError(() => new Error('Network error')));

      fixture.detectChanges();

      expect(component.loading()).toBe(false);
    });
  });
});
