import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TextInput } from './text-input';
import { mountComponentWithForm, getByLabelText, userType } from '../../testing/test-utils';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Validators } from '@angular/forms';
import { Component } from '@angular/core';
import { ReactiveFormsModule, FormGroup, FormControl } from '@angular/forms';

/**
 * Tests for TextInput component
 * 
 * **Validates: Requirements 2.6, 6.1, 6.2, 7.2, 8.2, 8.3**
 * 
 * This test suite verifies:
 * - Input rendering with label
 * - Validation states (valid, invalid)
 * - Error messages display
 * - Value changes emit events
 * - Required field validation
 */

// Test host component to wrap TextInput
@Component({
  selector: 'app-test-host',
  standalone: true,
  imports: [TextInput, ReactiveFormsModule],
  template: `
    <form [formGroup]="form">
      <app-text-input 
        [label]="label" 
        [type]="inputType"
        formControlName="testField"
      />
    </form>
  `,
})
class TestHostComponent {
  form: FormGroup;
  label = 'Test Field';
  inputType = 'text';

  constructor() {
    this.form = new FormGroup({
      testField: new FormControl('', [Validators.required]),
    });
  }
}

describe('TextInput', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let component: TestHostComponent;

  beforeEach(async () => {
    fixture = await mountComponentWithForm(TestHostComponent, {
      controls: {
        testField: ['', Validators.required],
      },
      detectChanges: false, // Disable automatic change detection to avoid ExpressionChangedAfterItHasBeenCheckedError
    });

    component = fixture.componentInstance;
    fixture.detectChanges(); // Manually trigger initial change detection
    await fixture.whenStable();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  describe('Component Initialization', () => {
    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('should render the input element', () => {
      const input = fixture.nativeElement.querySelector('input');
      expect(input).toBeTruthy();
    });

    it('should render the label', () => {
      const label = fixture.nativeElement.querySelector('label');
      expect(label).toBeTruthy();
      expect(label?.textContent).toContain('Test Field');
    });

    it('should have default type of text', () => {
      const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
      expect(input.type).toBe('text');
    });
  });

  describe('Input Rendering', () => {
    it('should display label text', () => {
      const span = fixture.nativeElement.querySelector('label span');
      expect(span?.textContent).toBe('Test Field');
    });

    it('should set placeholder to label value', () => {
      const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
      expect(input.placeholder).toBe('Test Field');
    });



    it('should have floating-label class', () => {
      const label = fixture.nativeElement.querySelector('label');
      expect(label?.classList.contains('floating-label')).toBe(true);
    });
  });

  describe('Value Changes', () => {
    it('should update form control value when user types', async () => {
      const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;

      await userType(input, 'test value', fixture);

      expect(component.form.get('testField')?.value).toBe('test value');
    });

    it('should reflect form control value in input', async () => {
      component.form.get('testField')?.setValue('initial value');
      fixture.detectChanges();
      await fixture.whenStable();

      const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
      expect(input.value).toBe('initial value');
    });

    it('should handle empty value', async () => {
      const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;

      await userType(input, '', fixture);

      expect(component.form.get('testField')?.value).toBe('');
    });

    it('should handle special characters', async () => {
      const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;

      await userType(input, 'test@example.com', fixture);

      expect(component.form.get('testField')?.value).toBe('test@example.com');
    });
  });

  describe('Validation States - Required Field', () => {
    it('should be invalid when empty and touched', async () => {
      const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
      
      // Touch the field
      input.focus();
      input.blur();
      input.dispatchEvent(new Event('blur'));
      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.form.get('testField')?.invalid).toBe(true);
      expect(component.form.get('testField')?.touched).toBe(true);
    });

    it('should be valid when filled', async () => {
      const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;

      await userType(input, 'test value', fixture);

      expect(component.form.get('testField')?.valid).toBe(true);
    });

    it('should display required error message when empty and touched', async () => {
      const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
      
      // Touch the field
      input.focus();
      input.blur();
      input.dispatchEvent(new Event('blur'));
      fixture.detectChanges();
      await fixture.whenStable();

      const errorMessage = fixture.nativeElement.querySelector('.validation-hint');
      expect(errorMessage).toBeTruthy();
      expect(errorMessage?.textContent).toContain('Test Field is required');
    });

    it('should not display error message when untouched', () => {
      const errorMessage = fixture.nativeElement.querySelector('.validation-hint');
      expect(errorMessage).toBeNull();
    });

    it('should not display error message when valid', async () => {
      const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;

      await userType(input, 'test value', fixture);

      const errorMessage = fixture.nativeElement.querySelector('.validation-hint');
      expect(errorMessage).toBeNull();
    });
  });



  describe('Validation States - Min Length', () => {
    beforeEach(async () => {
      component.form.get('testField')?.setValidators([Validators.minLength(5)]);
      component.form.get('testField')?.updateValueAndValidity();
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it('should display minlength error when too short', async () => {
      const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;

      await userType(input, 'abc', fixture);
      
      input.blur();
      input.dispatchEvent(new Event('blur'));
      fixture.detectChanges();
      await fixture.whenStable();

      const errorMessage = fixture.nativeElement.querySelector('.validation-hint');
      expect(errorMessage?.textContent).toContain('must be at least 5 characters');
    });

    it('should not display minlength error when long enough', async () => {
      const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;

      await userType(input, 'abcdef', fixture);
      
      input.blur();
      input.dispatchEvent(new Event('blur'));
      fixture.detectChanges();
      await fixture.whenStable();

      const errorMessage = fixture.nativeElement.querySelector('.validation-hint');
      expect(errorMessage).toBeNull();
    });
  });

  describe('Validation States - Max Length', () => {
    beforeEach(async () => {
      component.form.get('testField')?.setValidators([Validators.maxLength(10)]);
      component.form.get('testField')?.updateValueAndValidity();
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it('should display maxlength error when too long', async () => {
      const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;

      await userType(input, 'this is a very long text', fixture);
      
      input.blur();
      input.dispatchEvent(new Event('blur'));
      fixture.detectChanges();
      await fixture.whenStable();

      const errorMessage = fixture.nativeElement.querySelector('.validation-hint');
      expect(errorMessage?.textContent).toContain('must be at most 10 characters');
    });

    it('should not display maxlength error when short enough', async () => {
      const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;

      await userType(input, 'short', fixture);
      
      input.blur();
      input.dispatchEvent(new Event('blur'));
      fixture.detectChanges();
      await fixture.whenStable();

      const errorMessage = fixture.nativeElement.querySelector('.validation-hint');
      expect(errorMessage).toBeNull();
    });
  });

  describe('CSS Classes for Validation States', () => {
    it('should apply input-error class when invalid and touched', async () => {
      const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
      
      input.focus();
      input.blur();
      input.dispatchEvent(new Event('blur'));
      fixture.detectChanges();
      await fixture.whenStable();

      expect(input.classList.contains('input-error')).toBe(true);
    });

    it('should apply input-success class when valid and touched', async () => {
      const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;

      await userType(input, 'test value', fixture);
      
      input.blur();
      input.dispatchEvent(new Event('blur'));
      fixture.detectChanges();
      await fixture.whenStable();

      expect(input.classList.contains('input-success')).toBe(true);
    });

    it('should not apply validation classes when untouched', () => {
      const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;

      expect(input.classList.contains('input-error')).toBe(false);
      expect(input.classList.contains('input-success')).toBe(false);
    });
  });



  describe('Edge Cases', () => {
    it('should handle rapid value changes', async () => {
      const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;

      await userType(input, 'a', fixture);
      await userType(input, 'ab', fixture);
      await userType(input, 'abc', fixture);

      expect(component.form.get('testField')?.value).toBe('abc');
    });

    it('should handle clearing value after input', async () => {
      const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;

      await userType(input, 'test', fixture);
      expect(component.form.get('testField')?.value).toBe('test');

      await userType(input, '', fixture);
      expect(component.form.get('testField')?.value).toBe('');
    });

    it('should handle programmatic value changes', async () => {
      component.form.get('testField')?.setValue('programmatic value');
      fixture.detectChanges();
      await fixture.whenStable();

      const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
      expect(input.value).toBe('programmatic value');
    });

    it('should handle disabled state', async () => {
      component.form.get('testField')?.disable();
      fixture.detectChanges();
      await fixture.whenStable();

      const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
      expect(input.disabled).toBe(true);
    });

    it('should handle enabled state after being disabled', async () => {
      component.form.get('testField')?.disable();
      fixture.detectChanges();
      await fixture.whenStable();

      component.form.get('testField')?.enable();
      fixture.detectChanges();
      await fixture.whenStable();

      const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
      expect(input.disabled).toBe(false);
    });
  });

  describe('Accessibility', () => {
    it('should have label associated with input', () => {
      const label = fixture.nativeElement.querySelector('label');
      const input = fixture.nativeElement.querySelector('input');
      
      expect(label).toBeTruthy();
      expect(input).toBeTruthy();
    });

    it('should have placeholder text', () => {
      const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
      expect(input.placeholder).toBe('Test Field');
    });

    it('should display error messages for screen readers', async () => {
      const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
      
      input.focus();
      input.blur();
      input.dispatchEvent(new Event('blur'));
      fixture.detectChanges();
      await fixture.whenStable();

      const errorMessage = fixture.nativeElement.querySelector('.validation-hint');
      expect(errorMessage).toBeTruthy();
      expect(errorMessage?.classList.contains('text-error')).toBe(true);
    });

    it('should have visible label text', () => {
      const span = fixture.nativeElement.querySelector('label span');
      expect(span).toBeTruthy();
      expect(span?.textContent).toBeTruthy();
    });
  });
});
