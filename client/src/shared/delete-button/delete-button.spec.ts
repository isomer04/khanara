import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeleteButton } from './delete-button';
import { mountComponent, getByRole, userClick } from '../../testing/test-utils';
import { ComponentFixture } from '@angular/core/testing';

/**
 * Tests for DeleteButton component
 * 
 * **Validates: Requirements 2.2, 6.1, 6.2, 6.5**
 * 
 * This test suite verifies:
 * - Button rendering with correct label
 * - Click handling triggers delete action
 * - Loading state displays during deletion
 * - Disabled state when loading
 */
describe('DeleteButton', () => {
  let fixture: ComponentFixture<DeleteButton>;
  let component: DeleteButton;

  beforeEach(async () => {
    fixture = await mountComponent(DeleteButton);
    component = fixture.componentInstance;
  });

  describe('Component Initialization', () => {
    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('should have disabled input', () => {
      expect(component.disabled).toBeDefined();
    });

    it('should have clickEvent output', () => {
      expect(component.clickEvent).toBeDefined();
    });
  });

  describe('Button Rendering', () => {
    it('should render a button element', () => {
      const button = getByRole(fixture.nativeElement, 'button');
      expect(button).toBeTruthy();
    });

    it('should render delete icon (SVG)', () => {
      const svg = fixture.nativeElement.querySelector('svg');
      expect(svg).toBeTruthy();
    });

    it('should have error styling on icon', () => {
      const svg = fixture.nativeElement.querySelector('svg');
      expect(svg?.classList.contains('text-error')).toBe(true);
    });

    it('should not be disabled by default', () => {
      const button = getByRole(fixture.nativeElement, 'button');
      expect(button.hasAttribute('disabled')).toBe(false);
    });
  });

  describe('Click Handling', () => {
    it('should emit clickEvent when button is clicked', async () => {
      const clickSpy = vi.fn();
      component.clickEvent.subscribe(clickSpy);

      const button = getByRole(fixture.nativeElement, 'button');
      await userClick(button, fixture);

      expect(clickSpy).toHaveBeenCalled();
    });

    it('should emit the event object when clicked', async () => {
      let emittedEvent: Event | null = null;
      component.clickEvent.subscribe((event) => {
        emittedEvent = event;
      });

      const button = getByRole(fixture.nativeElement, 'button');
      await userClick(button, fixture);

      expect(emittedEvent).toBeTruthy();
      expect(emittedEvent).toBeInstanceOf(Event);
    });

    it('should call onClick method when button is clicked', async () => {
      const onClickSpy = vi.spyOn(component, 'onClick');

      const button = getByRole(fixture.nativeElement, 'button');
      await userClick(button, fixture);

      expect(onClickSpy).toHaveBeenCalled();
    });
  });

  describe('Disabled State', () => {
    it('should disable button when disabled input is true', async () => {
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();
      await fixture.whenStable();

      const button = getByRole(fixture.nativeElement, 'button');
      expect(button.hasAttribute('disabled')).toBe(true);
    });

    it('should not disable button when disabled input is false', async () => {
      fixture.componentRef.setInput('disabled', false);
      fixture.detectChanges();
      await fixture.whenStable();

      const button = getByRole(fixture.nativeElement, 'button');
      expect(button.hasAttribute('disabled')).toBe(false);
    });

    it('should apply opacity styling when disabled', async () => {
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();
      await fixture.whenStable();

      const svg = fixture.nativeElement.querySelector('svg');
      expect(svg?.classList.contains('opacity-25')).toBe(true);
    });

    it('should not apply opacity styling when enabled', async () => {
      fixture.componentRef.setInput('disabled', false);
      fixture.detectChanges();
      await fixture.whenStable();

      const svg = fixture.nativeElement.querySelector('svg');
      expect(svg?.classList.contains('opacity-25')).toBe(false);
    });

    it('should not emit clickEvent when disabled button is clicked', async () => {
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();
      await fixture.whenStable();

      const clickSpy = vi.fn();
      component.clickEvent.subscribe(clickSpy);

      const button = getByRole(fixture.nativeElement, 'button');
      
      // Try to click the disabled button
      // Note: Disabled buttons don't fire click events in the browser
      button.click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(clickSpy).not.toHaveBeenCalled();
    });
  });

  describe('Loading State Simulation', () => {
    it('should support disabled state during async operations', async () => {
      // Simulate loading state by setting disabled to true
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();
      await fixture.whenStable();

      const button = getByRole(fixture.nativeElement, 'button');
      expect(button.hasAttribute('disabled')).toBe(true);

      // Simulate operation complete by setting disabled to false
      fixture.componentRef.setInput('disabled', false);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(button.hasAttribute('disabled')).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid clicks when enabled', async () => {
      const clickSpy = vi.fn();
      component.clickEvent.subscribe(clickSpy);

      const button = getByRole(fixture.nativeElement, 'button');
      
      // Simulate rapid clicks
      await userClick(button, fixture);
      await userClick(button, fixture);
      await userClick(button, fixture);

      // Verify clicks were registered (at least 3 times)
      expect(clickSpy.mock.calls.length).toBeGreaterThanOrEqual(3);
    });

    it('should handle toggling disabled state multiple times', async () => {
      const button = getByRole(fixture.nativeElement, 'button');

      // Toggle disabled state multiple times
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(button.hasAttribute('disabled')).toBe(true);

      fixture.componentRef.setInput('disabled', false);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(button.hasAttribute('disabled')).toBe(false);

      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(button.hasAttribute('disabled')).toBe(true);
    });

    it('should maintain button structure when disabled state changes', async () => {
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();
      await fixture.whenStable();

      const svgWhenDisabled = fixture.nativeElement.querySelector('svg');
      expect(svgWhenDisabled).toBeTruthy();

      fixture.componentRef.setInput('disabled', false);
      fixture.detectChanges();
      await fixture.whenStable();

      const svgWhenEnabled = fixture.nativeElement.querySelector('svg');
      expect(svgWhenEnabled).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    it('should have button role', () => {
      const button = getByRole(fixture.nativeElement, 'button');
      expect(button.tagName).toBe('BUTTON');
    });

    it('should be keyboard accessible when enabled', async () => {
      const button = getByRole(fixture.nativeElement, 'button');
      expect(button.hasAttribute('disabled')).toBe(false);
    });

    it('should not be keyboard accessible when disabled', async () => {
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();
      await fixture.whenStable();

      const button = getByRole(fixture.nativeElement, 'button');
      expect(button.hasAttribute('disabled')).toBe(true);
    });

    it('should have cursor-pointer class for visual feedback', () => {
      const button = getByRole(fixture.nativeElement, 'button');
      expect(button.classList.contains('cursor-pointer')).toBe(true);
    });
  });
});
