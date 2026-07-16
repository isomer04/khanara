import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FavoriteButton } from './favorite-button';
import { mountComponent, getByRole, userClick } from '../../testing/test-utils';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { createMockAccountService, createMockFavoritesService, createMockRouter } from '../../testing/mock-services';
import { buildUser } from '../../testing/test-data-builders';
import { of, throwError } from 'rxjs';
import { signal } from '@angular/core';
import { AccountService } from '../../core/services/account-service';
import { FavoritesService } from '../../core/services/favorites-service';
import { Router } from '@angular/router';

/**
 * Tests for FavoriteButton component
 * 
 * **Validates: Requirements 2.3, 6.1, 6.2, 6.5, 7.1**
 * 
 * This test suite verifies:
 * - Toggle behavior (favorite/unfavorite)
 * - Visual state changes (icon changes)
 * - Error handling when toggle fails
 * - Loading state during toggle operation
 */
describe('FavoriteButton', () => {
  let fixture: ComponentFixture<FavoriteButton>;
  let component: FavoriteButton;
  let mockAccountService: ReturnType<typeof createMockAccountService>;
  let mockFavoritesService: ReturnType<typeof createMockFavoritesService>;
  let mockRouter: ReturnType<typeof createMockRouter>;

  beforeEach(async () => {
    // Create mock services
    mockAccountService = createMockAccountService({
      currentUser: signal(buildUser()),
    });
    
    mockFavoritesService = createMockFavoritesService({
      isFavorited: vi.fn().mockReturnValue(false),
      addFavorite: vi.fn().mockReturnValue(of(null)),
      removeFavorite: vi.fn().mockReturnValue(of(null)),
    });
    
    mockRouter = createMockRouter();

    fixture = await mountComponent(FavoriteButton, {
      providers: [
        { provide: AccountService, useValue: mockAccountService },
        { provide: FavoritesService, useValue: mockFavoritesService },
        { provide: Router, useValue: mockRouter },
      ],
      inputs: {
        cookId: 1,
      },
    });

    component = fixture.componentInstance;
  });

  describe('Component Initialization', () => {
    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('should require cookId input', () => {
      expect(component.cookId()).toBe(1);
    });

    it('should have pending signal initialized to false', () => {
      expect((component as any).pending()).toBe(false);
    });
  });

  describe('Button Rendering - Unfavorited State', () => {
    it('should render a button element', () => {
      const button = getByRole(fixture.nativeElement, 'button');
      expect(button).toBeTruthy();
    });

    it('should render outline heart icon when not favorited', () => {
      const svg = fixture.nativeElement.querySelector('svg');
      expect(svg).toBeTruthy();
      
      // Outline heart has stroke attribute
      const path = svg?.querySelector('path[stroke-linecap]');
      expect(path).toBeTruthy();
    });

    it('should have gray color when not favorited', () => {
      const button = getByRole(fixture.nativeElement, 'button');
      expect(button.classList.contains('text-gray-400')).toBe(true);
    });
  });

  describe('Button Rendering - Favorited State', () => {
    it('should render filled heart icon when favorited', async () => {
      // Reset TestBed and mock the isFavorited getter to return true BEFORE mounting
      TestBed.resetTestingModule();
      mockFavoritesService.isFavorited = vi.fn().mockReturnValue(true);
      
      // Remount the component with the updated mock
      fixture = await mountComponent(FavoriteButton, {
        providers: [
          { provide: AccountService, useValue: mockAccountService },
          { provide: FavoritesService, useValue: mockFavoritesService },
          { provide: Router, useValue: mockRouter },
        ],
        inputs: {
          cookId: 1,
        },
      });
      component = fixture.componentInstance;
      
      // Check the rendered DOM
      const button = getByRole(fixture.nativeElement, 'button');
      expect(button.classList.contains('text-rose-500')).toBe(true);
      
      // Filled heart has fill="currentColor" attribute
      const svg = fixture.nativeElement.querySelector('svg[fill="currentColor"]');
      expect(svg).toBeTruthy();
    });

    it('should have rose color when favorited', async () => {
      // Reset TestBed and mock the isFavorited getter to return true BEFORE mounting
      TestBed.resetTestingModule();
      mockFavoritesService.isFavorited = vi.fn().mockReturnValue(true);
      
      // Remount the component with the updated mock
      fixture = await mountComponent(FavoriteButton, {
        providers: [
          { provide: AccountService, useValue: mockAccountService },
          { provide: FavoritesService, useValue: mockFavoritesService },
          { provide: Router, useValue: mockRouter },
        ],
        inputs: {
          cookId: 1,
        },
      });
      component = fixture.componentInstance;
      
      // Check the rendered DOM
      const button = getByRole(fixture.nativeElement, 'button');
      expect(button.classList.contains('text-rose-500')).toBe(true);
      // The hover class is part of the button's base classes
      expect(button.classList.contains('hover:scale-110')).toBe(true);
    });
  });

  describe('Toggle Behavior - Add Favorite', () => {
    beforeEach(() => {
      mockFavoritesService.isFavorited = vi.fn().mockReturnValue(false);
      mockFavoritesService.addFavorite = vi.fn().mockReturnValue(of(null));
    });

    it('should call addFavorite when clicking unfavorited button', async () => {
      const button = getByRole(fixture.nativeElement, 'button');
      await userClick(button, fixture);

      expect(mockFavoritesService.addFavorite).toHaveBeenCalledWith(1);
    });

    it('should set pending to true during add operation', async () => {
      const button = getByRole(fixture.nativeElement, 'button');
      
      // Create a delayed observable to test pending state
      let resolveFn: any;
      const delayedObservable = new Promise((resolve) => {
        resolveFn = resolve;
      });
      
      mockFavoritesService.addFavorite = vi.fn().mockReturnValue(
        new (require('rxjs').Observable)((subscriber: any) => {
          delayedObservable.then(() => {
            subscriber.next(null);
            subscriber.complete();
          });
        })
      );

      button.click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect((component as any).pending()).toBe(true);
      
      // Resolve the operation
      resolveFn();
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    it('should set pending to false after add operation completes', async () => {
      const button = getByRole(fixture.nativeElement, 'button');
      await userClick(button, fixture);

      // Wait for async operation
      await new Promise(resolve => setTimeout(resolve, 10));

      expect((component as any).pending()).toBe(false);
    });
  });

  describe('Toggle Behavior - Remove Favorite', () => {
    beforeEach(() => {
      mockFavoritesService.isFavorited = vi.fn().mockReturnValue(true);
      mockFavoritesService.removeFavorite = vi.fn().mockReturnValue(of(null));
    });

    it('should call removeFavorite when clicking favorited button', async () => {
      const button = getByRole(fixture.nativeElement, 'button');
      await userClick(button, fixture);

      expect(mockFavoritesService.removeFavorite).toHaveBeenCalledWith(1);
    });

    it('should set pending to false after remove operation completes', async () => {
      const button = getByRole(fixture.nativeElement, 'button');
      await userClick(button, fixture);

      // Wait for async operation
      await new Promise(resolve => setTimeout(resolve, 10));

      expect((component as any).pending()).toBe(false);
    });
  });

  describe('Unauthenticated User Handling', () => {
    beforeEach(() => {
      mockAccountService.currentUser = signal(null);
    });

    it('should redirect to home when unauthenticated user clicks', async () => {
      const button = getByRole(fixture.nativeElement, 'button');
      await userClick(button, fixture);

      expect(mockRouter.navigateByUrl).toHaveBeenCalledWith('/');
    });

    it('should not call addFavorite when unauthenticated', async () => {
      const button = getByRole(fixture.nativeElement, 'button');
      await userClick(button, fixture);

      expect(mockFavoritesService.addFavorite).not.toHaveBeenCalled();
    });

    it('should not call removeFavorite when unauthenticated', async () => {
      mockFavoritesService.isFavorited = vi.fn().mockReturnValue(true);
      
      const button = getByRole(fixture.nativeElement, 'button');
      await userClick(button, fixture);

      expect(mockFavoritesService.removeFavorite).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle error when addFavorite fails', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('Network error');
      
      mockFavoritesService.isFavorited = vi.fn().mockReturnValue(false);
      mockFavoritesService.addFavorite = vi.fn().mockReturnValue(throwError(() => error));

      const button = getByRole(fixture.nativeElement, 'button');
      await userClick(button, fixture);

      // Wait for async operation
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to toggle favorite', error);
      
      consoleErrorSpy.mockRestore();
    });

    it('should handle error when removeFavorite fails', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('Network error');
      
      mockFavoritesService.isFavorited = vi.fn().mockReturnValue(true);
      mockFavoritesService.removeFavorite = vi.fn().mockReturnValue(throwError(() => error));

      const button = getByRole(fixture.nativeElement, 'button');
      await userClick(button, fixture);

      // Wait for async operation
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to toggle favorite', error);
      
      consoleErrorSpy.mockRestore();
    });

    it('should set pending to false after error', async () => {
      mockFavoritesService.isFavorited = vi.fn().mockReturnValue(false);
      mockFavoritesService.addFavorite = vi.fn().mockReturnValue(
        throwError(() => new Error('Network error'))
      );

      const button = getByRole(fixture.nativeElement, 'button');
      await userClick(button, fixture);

      // Wait for async operation
      await new Promise(resolve => setTimeout(resolve, 10));

      expect((component as any).pending()).toBe(false);
    });
  });

  describe('Pending State', () => {
    it('should prevent multiple simultaneous requests', async () => {
      mockFavoritesService.isFavorited = vi.fn().mockReturnValue(false);
      
      // Create a delayed observable
      let resolveFn: any;
      const delayedObservable = new Promise((resolve) => {
        resolveFn = resolve;
      });
      
      mockFavoritesService.addFavorite = vi.fn().mockReturnValue(
        new (require('rxjs').Observable)((subscriber: any) => {
          delayedObservable.then(() => {
            subscriber.next(null);
            subscriber.complete();
          });
        })
      );

      const button = getByRole(fixture.nativeElement, 'button');
      
      // First click
      button.click();
      fixture.detectChanges();
      await fixture.whenStable();

      // Second click while pending
      button.click();
      fixture.detectChanges();
      await fixture.whenStable();

      // Should only be called once
      expect(mockFavoritesService.addFavorite).toHaveBeenCalledTimes(1);
      
      // Resolve the operation
      resolveFn();
      await new Promise(resolve => setTimeout(resolve, 10));
    });
  });

  describe('Event Handling', () => {
    it('should prevent default event behavior', async () => {
      const button = getByRole(fixture.nativeElement, 'button');
      const event = new MouseEvent('click', { bubbles: true, cancelable: true });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      button.dispatchEvent(event);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('should stop event propagation', async () => {
      const button = getByRole(fixture.nativeElement, 'button');
      const event = new MouseEvent('click', { bubbles: true, cancelable: true });
      const stopPropagationSpy = vi.spyOn(event, 'stopPropagation');

      button.dispatchEvent(event);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(stopPropagationSpy).toHaveBeenCalled();
    });
  });

  describe('Accessibility - Unfavorited State', () => {
    it('should have aria-label for unfavorited state', () => {
      const button = getByRole(fixture.nativeElement, 'button');
      expect(button.getAttribute('aria-label')).toBe('Add to favorites');
    });

    it('should have title attribute for unfavorited state', () => {
      const button = getByRole(fixture.nativeElement, 'button');
      expect(button.getAttribute('title')).toBe('Add to favorites');
    });

    it('should have button role', () => {
      const button = getByRole(fixture.nativeElement, 'button');
      expect(button.tagName).toBe('BUTTON');
    });
  });

  describe('Accessibility - Favorited State', () => {
    it('should have aria-label for favorited state when isFavorited is true', async () => {
      // Reset TestBed and mock the isFavorited getter to return true BEFORE mounting
      TestBed.resetTestingModule();
      mockFavoritesService.isFavorited = vi.fn().mockReturnValue(true);
      
      // Remount the component with the updated mock
      fixture = await mountComponent(FavoriteButton, {
        providers: [
          { provide: AccountService, useValue: mockAccountService },
          { provide: FavoritesService, useValue: mockFavoritesService },
          { provide: Router, useValue: mockRouter },
        ],
        inputs: {
          cookId: 1,
        },
      });
      component = fixture.componentInstance;
      
      // Check the rendered DOM
      const button = getByRole(fixture.nativeElement, 'button');
      expect(button.getAttribute('aria-label')).toBe('Remove from favorites');
    });

    it('should have title attribute for favorited state when isFavorited is true', async () => {
      // Reset TestBed and mock the isFavorited getter to return true BEFORE mounting
      TestBed.resetTestingModule();
      mockFavoritesService.isFavorited = vi.fn().mockReturnValue(true);
      
      // Remount the component with the updated mock
      fixture = await mountComponent(FavoriteButton, {
        providers: [
          { provide: AccountService, useValue: mockAccountService },
          { provide: FavoritesService, useValue: mockFavoritesService },
          { provide: Router, useValue: mockRouter },
        ],
        inputs: {
          cookId: 1,
        },
      });
      component = fixture.componentInstance;
      
      // Check the rendered DOM
      const button = getByRole(fixture.nativeElement, 'button');
      expect(button.getAttribute('title')).toBe('Remove from favorites');
    });
  });

  describe('Edge Cases', () => {
    it('should handle cookId changes', async () => {
      fixture.componentRef.setInput('cookId', 2);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.cookId()).toBe(2);
    });

    it('should check favorited status with current cookId', () => {
      component.isFavorited;
      expect(mockFavoritesService.isFavorited).toHaveBeenCalledWith(1);
    });
  });
});
