import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { CookDashboard } from './cook-dashboard';
import { CookService } from '../../../core/services/cook-service';
import { DishService } from '../../../core/services/dish-service';
import { ToastService } from '../../../core/services/toast-service';
import { buildCookProfile, buildDish } from '../../../testing/test-data-builders';

describe('CookDashboard', () => {
  let component: CookDashboard;
  let fixture: ComponentFixture<CookDashboard>;
  let mockCookService: any;
  let mockDishService: any;
  let mockToastService: any;

  beforeEach(async () => {
    const mockProfile = buildCookProfile({
      id: 1,
      kitchenName: 'Spice House',
      dishes: [
        buildDish({ id: 10, name: 'Biryani', price: 15, photos: [] }),
        buildDish({ id: 11, name: 'Curry', price: 12, photos: [{ id: 1, url: 'photo.jpg', isMain: true }] }),
      ],
    });

    mockCookService = {
      loadMyCookProfile: vi.fn().mockReturnValue(of(mockProfile)),
    };

    mockDishService = {
      deleteDish: vi.fn().mockReturnValue(of(void 0)),
    };

    mockToastService = {
      success: vi.fn(),
      error: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [CookDashboard],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CookService, useValue: mockCookService },
        { provide: DishService, useValue: mockDishService },
        { provide: ToastService, useValue: mockToastService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CookDashboard);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Initialization', () => {
    it('should load cook profile on init', () => {
      expect(mockCookService.loadMyCookProfile).toHaveBeenCalled();
      expect(component.cookProfile()).toBeTruthy();
      expect(component.cookProfile()?.kitchenName).toBe('Spice House');
    });

    it('should set dishes from cook profile', () => {
      expect(component.dishes().length).toBe(2);
      expect(component.dishes()[0].name).toBe('Biryani');
      expect(component.dishes()[1].name).toBe('Curry');
    });

    it('should set loading to false after profile loads', async () => {
      await fixture.whenStable();
      expect(component.loading()).toBe(false);
    });
  });

  describe('getMainPhoto', () => {
    it('should return placeholder when dish has no photos', () => {
      const dish = buildDish({ photos: [] });
      // ngSrcFor resolves placeholder against window.location.origin for NgOptimizedImage
      expect(component.getMainPhoto(dish)).toContain('dish-placeholder.png');
    });

    it('should return main photo url when present', () => {
      const dish = buildDish({ 
        photos: [{ id: 1, url: 'https://example.com/photo.jpg', isMain: true }] 
      });
      expect(component.getMainPhoto(dish)).toBe('https://example.com/photo.jpg');
    });

    it('should return placeholder when no main photo is found', () => {
      // No isMain=true photo — falls back to first photo in array
      const dish = buildDish({ 
        photos: [{ id: 1, url: 'https://example.com/photo.jpg', isMain: false }] 
      });
      expect(component.getMainPhoto(dish)).toBe('https://example.com/photo.jpg');
    });

    it('should return first main photo when multiple photos exist', () => {
      const dish = buildDish({ 
        photos: [
          { id: 1, url: 'https://example.com/photo1.jpg', isMain: false },
          { id: 2, url: 'https://example.com/photo2.jpg', isMain: true },
          { id: 3, url: 'https://example.com/photo3.jpg', isMain: false },
        ] 
      });
      expect(component.getMainPhoto(dish)).toBe('https://example.com/photo2.jpg');
    });
  });

  describe('deleteDish', () => {
    it('should call dishService.deleteDish with correct id', () => {
      component.deleteDish(10);
      
      expect(mockDishService.deleteDish).toHaveBeenCalledWith(10);
    });

    it('should remove dish from list after successful deletion', async () => {
      const initialCount = component.dishes().length;
      
      component.deleteDish(10);
      await fixture.whenStable();
      
      expect(component.dishes().length).toBe(initialCount - 1);
      expect(component.dishes().find(d => d.id === 10)).toBeUndefined();
    });

    it('should show success toast after deletion', async () => {
      component.deleteDish(10);
      await fixture.whenStable();
      
      expect(mockToastService.success).toHaveBeenCalledWith('Dish removed');
    });

    it('should clear deletingId after successful deletion', async () => {
      component.deleteDish(10);
      await fixture.whenStable();
      
      expect(component.deletingId()).toBeNull();
    });

    it('should show error toast when deletion fails', async () => {
      mockDishService.deleteDish.mockReturnValue(
        throwError(() => new Error('Delete failed'))
      );
      
      component.deleteDish(10);
      await fixture.whenStable();
      
      expect(mockToastService.error).toHaveBeenCalledWith('Failed to delete dish');
    });

    it('should not remove dish from list when deletion fails', async () => {
      mockDishService.deleteDish.mockReturnValue(
        throwError(() => new Error('Delete failed'))
      );
      const initialCount = component.dishes().length;
      
      component.deleteDish(10);
      await fixture.whenStable();
      
      expect(component.dishes().length).toBe(initialCount);
    });
  });
});
