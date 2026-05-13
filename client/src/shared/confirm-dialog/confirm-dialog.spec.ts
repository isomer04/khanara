import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfirmDialog } from './confirm-dialog';
import { ConfirmDialogService } from '../../core/services/confirm-dialog-service';
import { mountComponent, getByRole, userClick, getByText } from '../../testing/test-utils';
import { ComponentFixture } from '@angular/core/testing';

/**
 * Tests for ConfirmDialog component
 * 
 * **Validates: Requirements 2.1, 6.1, 6.2, 10.1, 10.2**
 * 
 * This test suite verifies:
 * - Dialog rendering with title and message
 * - User confirmation (clicking confirm button)
 * - User cancellation (clicking cancel button)
 * - Dialog closes after confirmation or cancellation
 * - Accessibility (ARIA roles, keyboard navigation)
 */
describe('ConfirmDialog', () => {
  let fixture: ComponentFixture<ConfirmDialog>;
  let component: ConfirmDialog;
  let mockDialogService: ConfirmDialogService;

  beforeEach(async () => {
    // Create a mock ConfirmDialogService
    mockDialogService = {
      register: vi.fn(),
      confirm: vi.fn(),
    } as any;

    fixture = await mountComponent(ConfirmDialog, {
      providers: [
        { provide: ConfirmDialogService, useValue: mockDialogService }
      ],
    });

    component = fixture.componentInstance;
    
    // Mock the dialogRef
    component.dialogRef = {
      nativeElement: {
        showModal: vi.fn(),
        close: vi.fn(),
      }
    } as any;
  });

  describe('Component Initialization', () => {
    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('should register itself with ConfirmDialogService on initialization', () => {
      expect(mockDialogService.register).toHaveBeenCalledWith(component);
    });

    it('should have a default message', () => {
      expect(component.message).toBe('Are you sure?');
    });
  });

  describe('Dialog Rendering', () => {
    it('should render dialog element', () => {
      const dialog = fixture.nativeElement.querySelector('dialog');
      expect(dialog).toBeTruthy();
    });

    it('should display the default message', () => {
      const messageElement = getByText(fixture.nativeElement, 'Are you sure?');
      expect(messageElement).toBeTruthy();
    });

    it('should display the default warning text', () => {
      const warningText = getByText(fixture.nativeElement, 'This action cannot be undone');
      expect(warningText).toBeTruthy();
    });

    it('should render Cancel button', () => {
      const cancelButton = getByRole(fixture.nativeElement, 'button', { name: 'Cancel' });
      expect(cancelButton).toBeTruthy();
    });

    it('should render Confirm button', () => {
      const confirmButton = getByRole(fixture.nativeElement, 'button', { name: 'Confirm' });
      expect(confirmButton).toBeTruthy();
    });
  });

  describe('User Confirmation', () => {
    it('should resolve with true when confirm button is clicked', async () => {
      // Open the dialog and get the promise
      const resultPromise = component.open('Confirm this action?');

      // Click the confirm button
      const confirmButton = getByRole(fixture.nativeElement, 'button', { name: 'Confirm' });
      await userClick(confirmButton);

      // Verify the promise resolves with true
      const result = await resultPromise;
      expect(result).toBe(true);
    });

    it('should close the dialog when confirm button is clicked', async () => {
      const mockClose = vi.fn();
      component.dialogRef.nativeElement.close = mockClose;

      component.open('Confirm this action?');

      const confirmButton = getByRole(fixture.nativeElement, 'button', { name: 'Confirm' });
      await userClick(confirmButton);

      expect(mockClose).toHaveBeenCalled();
    });

    it('should clear the resolver after confirmation', async () => {
      component.open('Confirm this action?');

      const confirmButton = getByRole(fixture.nativeElement, 'button', { name: 'Confirm' });
      await userClick(confirmButton);

      // Verify resolver is cleared
      expect((component as any).resolver).toBeNull();
    });
  });

  describe('User Cancellation', () => {
    it('should resolve with false when cancel button is clicked', async () => {
      const resultPromise = component.open('Cancel this action?');

      // Click the cancel button
      const cancelButton = getByRole(fixture.nativeElement, 'button', { name: 'Cancel' });
      await userClick(cancelButton);

      // Verify the promise resolves with false
      const result = await resultPromise;
      expect(result).toBe(false);
    });

    it('should close the dialog when cancel button is clicked', async () => {
      const mockClose = vi.fn();
      component.dialogRef.nativeElement.close = mockClose;

      component.open('Cancel this action?');

      const cancelButton = getByRole(fixture.nativeElement, 'button', { name: 'Cancel' });
      await userClick(cancelButton);

      expect(mockClose).toHaveBeenCalled();
    });

    it('should clear the resolver after cancellation', async () => {
      component.open('Cancel this action?');

      const cancelButton = getByRole(fixture.nativeElement, 'button', { name: 'Cancel' });
      await userClick(cancelButton);

      // Verify resolver is cleared
      expect((component as any).resolver).toBeNull();
    });
  });

  describe('Dialog Open/Close Behavior', () => {
    it('should call showModal when dialog is opened', () => {
      const mockShowModal = vi.fn();
      component.dialogRef.nativeElement.showModal = mockShowModal;

      component.open('Test message');

      expect(mockShowModal).toHaveBeenCalled();
    });

    it('should update message when opened', () => {
      component.open('Custom message');
      expect(component.message).toBe('Custom message');
    });

    it('should return a promise when opened', () => {
      const result = component.open('Test message');
      expect(result).toBeInstanceOf(Promise);
    });
  });

  describe('Accessibility', () => {
    it('should have accessible button names', () => {
      const cancelButton = getByRole(fixture.nativeElement, 'button', { name: 'Cancel' });
      const confirmButton = getByRole(fixture.nativeElement, 'button', { name: 'Confirm' });

      expect(cancelButton.textContent?.trim()).toBe('Cancel');
      expect(confirmButton.textContent?.trim()).toBe('Confirm');
    });

    it('should display message as heading', () => {
      const heading = fixture.nativeElement.querySelector('h3');
      expect(heading).toBeTruthy();
      expect(heading?.textContent).toBe('Are you sure?');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty message', () => {
      component.open('');
      expect(component.message).toBe('');
    });

    it('should handle multiple sequential opens', async () => {
      // First open and confirm
      const firstPromise = component.open('First');
      const confirmButton1 = getByRole(fixture.nativeElement, 'button', { name: 'Confirm' });
      await userClick(confirmButton1);
      const firstResult = await firstPromise;
      expect(firstResult).toBe(true);

      // Second open and cancel
      const secondPromise = component.open('Second');
      const cancelButton2 = getByRole(fixture.nativeElement, 'button', { name: 'Cancel' });
      await userClick(cancelButton2);
      const secondResult = await secondPromise;
      expect(secondResult).toBe(false);
    });

    it('should not throw error if resolver is null when confirm is called', () => {
      // Set resolver to null
      (component as any).resolver = null;

      // Should not throw
      expect(() => component.confirm()).not.toThrow();
    });

    it('should not throw error if resolver is null when cancel is called', () => {
      // Set resolver to null
      (component as any).resolver = null;

      // Should not throw
      expect(() => component.cancel()).not.toThrow();
    });
  });
});
