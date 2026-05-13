import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Paginator } from './paginator';
import { mountComponent, userClick, userSelectOption } from '../../testing/test-utils';
import { ComponentFixture } from '@angular/core/testing';

/**
 * Tests for Paginator component
 * 
 * **Validates: Requirements 2.5, 6.1, 6.2**
 * 
 * This test suite verifies:
 * - Page navigation (next, previous, specific page)
 * - Boundary conditions (first page, last page)
 * - Page size changes
 * - Disabled state for boundary buttons
 */
describe('Paginator', () => {
  let fixture: ComponentFixture<Paginator>;
  let component: Paginator;

  beforeEach(async () => {
    fixture = await mountComponent(Paginator, {
      inputs: {
        totalCount: 100,
        totalPages: 10,
        pageSizeOptions: [5, 10, 20, 50],
      },
    });

    component = fixture.componentInstance;
    // Reset to initial state
    component.pageNumber.set(1);
    component.pageSize.set(10);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  describe('Component Initialization', () => {
    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('should have pageNumber model initialized to 1', () => {
      expect(component.pageNumber()).toBe(1);
    });

    it('should have pageSize model initialized to 10', () => {
      expect(component.pageSize()).toBe(10);
    });

    it('should have totalCount input', () => {
      expect(component.totalCount()).toBe(100);
    });

    it('should have totalPages input', () => {
      expect(component.totalPages()).toBe(10);
    });

    it('should have pageSizeOptions input', () => {
      expect(component.pageSizeOptions()).toEqual([5, 10, 20, 50]);
    });

    it('should have pageChange output', () => {
      expect(component.pageChange).toBeDefined();
    });
  });

  describe('Paginator Rendering', () => {
    it('should render page size selector', () => {
      const select = fixture.nativeElement.querySelector('select');
      expect(select).toBeTruthy();
    });

    it('should render page size options', () => {
      const options = fixture.nativeElement.querySelectorAll('option');
      expect(options.length).toBe(4);
    });

    it('should render item range display', () => {
      const text = fixture.nativeElement.textContent;
      expect(text).toContain('1 - 10 of 100');
    });

    it('should render previous and next buttons', () => {
      const buttons = fixture.nativeElement.querySelectorAll('button');
      expect(buttons.length).toBe(2);
    });

    it('should render Items per page label', () => {
      const text = fixture.nativeElement.textContent;
      expect(text).toContain('Items per page:');
    });
  });

  describe('Page Navigation - Next Page', () => {
    it('should navigate to next page when next button is clicked', async () => {
      const buttons = fixture.nativeElement.querySelectorAll('button');
      const nextButton = buttons[1] as HTMLButtonElement;

      nextButton.click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.pageNumber()).toBe(2);
    });

    it('should emit pageChange event when next button is clicked', async () => {
      const pageChangeSpy = vi.fn();
      component.pageChange.subscribe(pageChangeSpy);

      const buttons = fixture.nativeElement.querySelectorAll('button');
      const nextButton = buttons[1] as HTMLButtonElement;

      nextButton.click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(pageChangeSpy).toHaveBeenCalledWith({
        pageNumber: 2,
        pageSize: 10,
      });
    });

    it('should update item range display after navigating to next page', async () => {
      const buttons = fixture.nativeElement.querySelectorAll('button');
      const nextButton = buttons[1] as HTMLButtonElement;

      nextButton.click();
      fixture.detectChanges();
      await fixture.whenStable();

      const text = fixture.nativeElement.textContent;
      expect(text).toContain('11 - 20 of 100');
    });
  });

  describe('Page Navigation - Previous Page', () => {
    beforeEach(async () => {
      component.pageNumber.set(3);
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it('should navigate to previous page when previous button is clicked', async () => {
      const buttons = fixture.nativeElement.querySelectorAll('button');
      const prevButton = buttons[0] as HTMLButtonElement;

      prevButton.click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.pageNumber()).toBe(2);
    });

    it('should emit pageChange event when previous button is clicked', async () => {
      const pageChangeSpy = vi.fn();
      component.pageChange.subscribe(pageChangeSpy);

      const buttons = fixture.nativeElement.querySelectorAll('button');
      const prevButton = buttons[0] as HTMLButtonElement;

      prevButton.click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(pageChangeSpy).toHaveBeenCalledWith({
        pageNumber: 2,
        pageSize: 10,
      });
    });

    it('should update item range display after navigating to previous page', async () => {
      const buttons = fixture.nativeElement.querySelectorAll('button');
      const prevButton = buttons[0] as HTMLButtonElement;

      prevButton.click();
      fixture.detectChanges();
      await fixture.whenStable();

      const text = fixture.nativeElement.textContent;
      expect(text).toContain('11 - 20 of 100');
    });
  });

  describe('Boundary Conditions - First Page', () => {
    it('should disable previous button on first page', () => {
      const buttons = fixture.nativeElement.querySelectorAll('button');
      const prevButton = buttons[0] as HTMLButtonElement;

      expect(prevButton.hasAttribute('disabled')).toBe(true);
    });

    it('should not disable next button on first page', () => {
      const buttons = fixture.nativeElement.querySelectorAll('button');
      const nextButton = buttons[1] as HTMLButtonElement;

      expect(nextButton.hasAttribute('disabled')).toBe(false);
    });

    it('should display correct item range on first page', () => {
      const text = fixture.nativeElement.textContent;
      expect(text).toContain('1 - 10 of 100');
    });
  });

  describe('Boundary Conditions - Last Page', () => {
    beforeEach(async () => {
      component.pageNumber.set(10);
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it('should disable next button on last page', () => {
      const buttons = fixture.nativeElement.querySelectorAll('button');
      const nextButton = buttons[1] as HTMLButtonElement;

      expect(nextButton.hasAttribute('disabled')).toBe(true);
    });

    it('should not disable previous button on last page', () => {
      const buttons = fixture.nativeElement.querySelectorAll('button');
      const prevButton = buttons[0] as HTMLButtonElement;

      expect(prevButton.hasAttribute('disabled')).toBe(false);
    });

    it('should display correct item range on last page', () => {
      const text = fixture.nativeElement.textContent;
      expect(text).toContain('91 - 100 of 100');
    });
  });

  describe('Page Size Changes', () => {
    it('should change page size when selecting different option', async () => {
      const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;

      await userSelectOption(select, '20', fixture);

      expect(component.pageSize()).toBe(20);
    });

    it('should emit pageChange event when page size changes', async () => {
      const pageChangeSpy = vi.fn();
      component.pageChange.subscribe(pageChangeSpy);

      const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;

      await userSelectOption(select, '20', fixture);

      expect(pageChangeSpy).toHaveBeenCalledWith({
        pageNumber: 1,
        pageSize: 20,
      });
    });

    it('should update item range display after page size change', async () => {
      const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;

      await userSelectOption(select, '20', fixture);

      const text = fixture.nativeElement.textContent;
      expect(text).toContain('1 - 20 of 100');
    });

    it('should handle changing to smaller page size', async () => {
      const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;

      await userSelectOption(select, '5', fixture);

      expect(component.pageSize()).toBe(5);
      
      const text = fixture.nativeElement.textContent;
      expect(text).toContain('1 - 5 of 100');
    });

    it('should handle changing to larger page size', async () => {
      const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;

      await userSelectOption(select, '50', fixture);

      expect(component.pageSize()).toBe(50);
      
      const text = fixture.nativeElement.textContent;
      expect(text).toContain('1 - 50 of 100');
    });
  });

  describe('Last Item Index Calculation', () => {
    it('should calculate correct last item index for middle page', async () => {
      component.pageNumber.set(5);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.lastItemIndex()).toBe(50);
    });

    it('should calculate correct last item index for last page', async () => {
      component.pageNumber.set(10);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.lastItemIndex()).toBe(100);
    });

    it('should not exceed total count on last page', async () => {
      fixture.componentRef.setInput('totalCount', 95);
      component.pageNumber.set(10);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.lastItemIndex()).toBe(95);
    });

    it('should handle page size larger than total count', async () => {
      fixture.componentRef.setInput('totalCount', 5);
      component.pageSize.set(50);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.lastItemIndex()).toBe(5);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero total count', async () => {
      fixture.componentRef.setInput('totalCount', 0);
      fixture.componentRef.setInput('totalPages', 0);
      fixture.detectChanges();
      await fixture.whenStable();

      const text = fixture.nativeElement.textContent;
      expect(text).toContain('1 - 0 of 0');
    });

    it('should handle single page scenario', async () => {
      fixture.componentRef.setInput('totalCount', 5);
      fixture.componentRef.setInput('totalPages', 1);
      fixture.detectChanges();
      await fixture.whenStable();

      const buttons = fixture.nativeElement.querySelectorAll('button');
      const prevButton = buttons[0] as HTMLButtonElement;
      const nextButton = buttons[1] as HTMLButtonElement;

      expect(prevButton.hasAttribute('disabled')).toBe(true);
      expect(nextButton.hasAttribute('disabled')).toBe(true);
    });

    it('should handle page size change followed by navigation', async () => {
      const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
      await userSelectOption(select, '20', fixture);

      const buttons = fixture.nativeElement.querySelectorAll('button');
      const nextButton = buttons[1] as HTMLButtonElement;
      nextButton.click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.pageNumber()).toBe(2);
      expect(component.pageSize()).toBe(20);

      const text = fixture.nativeElement.textContent;
      expect(text).toContain('21 - 40 of 100');
    });

    it('should handle large total count', async () => {
      fixture.componentRef.setInput('totalCount', 10000);
      fixture.componentRef.setInput('totalPages', 1000);
      fixture.detectChanges();
      await fixture.whenStable();

      const text = fixture.nativeElement.textContent;
      expect(text).toContain('1 - 10 of 10000');
    });
  });

  describe('Accessibility', () => {
    it('should have accessible buttons', () => {
      const buttons = fixture.nativeElement.querySelectorAll('button');
      expect(buttons.length).toBe(2);
      expect(buttons[0].tagName).toBe('BUTTON');
      expect(buttons[1].tagName).toBe('BUTTON');
    });

    it('should have accessible select element', () => {
      const select = fixture.nativeElement.querySelector('select');
      expect(select).toBeTruthy();
      expect(select?.tagName).toBe('SELECT');
    });

    it('should have descriptive label for page size selector', () => {
      const text = fixture.nativeElement.textContent;
      expect(text).toContain('Items per page:');
    });

    it('should disable buttons appropriately for keyboard navigation', () => {
      const buttons = fixture.nativeElement.querySelectorAll('button');
      const prevButton = buttons[0] as HTMLButtonElement;

      expect(prevButton.hasAttribute('disabled')).toBe(true);
    });
  });
});
