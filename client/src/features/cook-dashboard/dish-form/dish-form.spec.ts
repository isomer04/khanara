import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { DishForm } from './dish-form';
import { DishService } from '../../../core/services/dish-service';
import { ToastService } from '../../../core/services/toast-service';
import { buildDish } from '../../../testing/test-data-builders';
import { createMockToastService } from '../../../testing/mock-services';

describe('DishForm', () => {
  let component: DishForm;
  let fixture: ComponentFixture<DishForm>;
  let mockDishService: {
    getDish: ReturnType<typeof vi.fn>;
    createDish: ReturnType<typeof vi.fn>;
    updateDish: ReturnType<typeof vi.fn>;
    uploadPhoto: ReturnType<typeof vi.fn>;
    deletePhoto: ReturnType<typeof vi.fn>;
  };
  let mockToast: ReturnType<typeof createMockToastService>;

  beforeEach(async () => {
    mockDishService = {
      getDish: vi.fn(),
      createDish: vi.fn().mockReturnValue(of(buildDish({ id: 42, portionsRemainingToday: 6 }))),
      updateDish: vi.fn(),
      uploadPhoto: vi.fn(),
      deletePhoto: vi.fn(),
    };
    mockToast = createMockToastService();

    await TestBed.configureTestingModule({
      imports: [DishForm],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: DishService, useValue: mockDishService },
        { provide: ToastService, useValue: mockToast },
        // No :id, so the form is in create mode
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({}) } } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DishForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  const form = () => component['form'];
  const fillValidForm = () => {
    form().name = 'Biryani';
    form().price = 12;
    form().portionsPerBatch = 6;
  };
  const isFormVisible = () => !!fixture.nativeElement.querySelector('#dish-name');

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should list client-side errors and not call the API for an empty form', () => {
    form().price = 0;

    component.submit();
    fixture.detectChanges();

    expect(mockDishService.createDish).not.toHaveBeenCalled();
    expect(component['validationErrors']()).toEqual([
      'Name is required',
      'Price must be greater than 0',
    ]);
    expect(fixture.nativeElement.textContent).toContain('Name is required');
  });

  it('should reject negative prices and zero portions', () => {
    fillValidForm();
    form().price = -5;
    form().portionsPerBatch = 0;

    component.submit();

    expect(mockDishService.createDish).not.toHaveBeenCalled();
    expect(component['validationErrors']()).toEqual([
      'Price must be greater than 0',
      'Portions per batch must be a whole number of at least 1',
    ]);
  });

  it('should keep the form (not a spinner) after a server validation error', () => {
    mockDishService.createDish.mockReturnValue(
      throwError(() => ['Price must be greater than 0'])
    );
    fillValidForm();

    component.submit();
    fixture.detectChanges();

    expect(component['saving']()).toBe(false);
    expect(isFormVisible()).toBe(true);
    expect(form().name).toBe('Biryani');
    expect(component['validationErrors']()).toEqual(['Price must be greater than 0']);
  });

  it('should switch to edit mode with the new dish after creating it', () => {
    fillValidForm();
    form().name = '  Biryani  ';

    component.submit();
    fixture.detectChanges();

    expect(mockDishService.createDish).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Biryani', price: 12, portionsPerBatch: 6 })
    );
    expect(component['isEditMode']()).toBe(true);
    expect(component['dishId']()).toBe(42);
    expect(form().portionsRemainingToday).toBe(6);
    expect(isFormVisible()).toBe(true);
  });

  it('should reset the upload spinner when a photo upload fails', () => {
    component['dishId'].set(42);
    mockDishService.uploadPhoto.mockReturnValue(throwError(() => new Error('400')));

    component.onUploadPhoto(new File(['x'], 'a.jpg', { type: 'image/jpeg' }));

    expect(component['photoUploading']()).toBe(false);
  });
});
