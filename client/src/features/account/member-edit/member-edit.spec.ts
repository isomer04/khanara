import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError, Observable } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemberEdit } from './member-edit';
import { MemberService, MemberProfile } from '../../../core/services/member-service';
import { AccountService } from '../../../core/services/account-service';
import { ToastService } from '../../../core/services/toast-service';
import { signal } from '@angular/core';
import { User } from '../../../types/user';

/**
 * Tests for MemberEdit component - Profile editing
 * 
 * **Validates: Requirements 3.1, 6.3, 6.4, 6.5, 7.1, 7.2**
 * 
 * This test suite verifies:
 * - Profile form rendering with user data
 * - Profile update flow
 * - Validation errors prevent submission
 * - Successful update displays success message
 * - Failed update displays error message
 */

describe('MemberEdit', () => {
  let component: MemberEdit;
  let fixture: ComponentFixture<MemberEdit>;
  let mockMemberService: any;
  let mockAccountService: any;
  let mockToastService: any;
  let mockRouter: any;

  const mockUser: User = {
    id: '1',
    email: 'test@example.com',
    displayName: 'Test User',
    token: 'fake-token',
    roles: [],
  };

  const mockMember: MemberProfile = {
    id: '1',
    email: 'test@example.com',
    displayName: 'Test User',
    imageUrl: '/user.png',
    gender: 'male',
    dateOfBirth: '1990-01-01',
    city: 'New York',
    country: 'USA',
    created: '2024-01-01',
  };

  beforeEach(async () => {
    mockMemberService = {
      getMember: vi.fn(),
      updateMember: vi.fn(),
      uploadPhoto: vi.fn(),
    };

    mockAccountService = {
      currentUser: signal(mockUser),
    };

    mockToastService = {
      success: vi.fn(),
      error: vi.fn(),
    };

    mockRouter = {
      navigate: vi.fn(),
      navigateByUrl: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [MemberEdit],
      providers: [
        { provide: MemberService, useValue: mockMemberService },
        { provide: AccountService, useValue: mockAccountService },
        { provide: ToastService, useValue: mockToastService },
        { provide: Router, useValue: mockRouter },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MemberEdit);
    component = fixture.componentInstance;
  });

  describe('Profile Form Rendering', () => {
    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('should load member profile on init', () => {
      mockMemberService.getMember.mockReturnValue(of(mockMember));
      
      fixture.detectChanges();
      
      expect(mockMemberService.getMember).toHaveBeenCalledWith('1');
      expect(component.member()).toEqual(mockMember);
    });

    it('should populate form with member data', () => {
      mockMemberService.getMember.mockReturnValue(of(mockMember));
      
      fixture.detectChanges();
      
      expect(component.form.displayName).toBe('Test User');
    });

    it('should display loading spinner while loading', async () => {
      // Create a delayed observable to keep loading state true
      const delayedMember = new Observable(subscriber => {
        setTimeout(() => {
          subscriber.next(mockMember);
          subscriber.complete();
        }, 100);
      });
      mockMemberService.getMember.mockReturnValue(delayedMember);
      
      fixture.detectChanges();
      
      // Check if loading signal is true immediately after init
      expect(component.loading()).toBe(true);
      
      // Wait for the observable to complete
      await fixture.whenStable();
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // After completion, loading should be false
      expect(component.loading()).toBe(false);
    });

    it('should display profile form after loading', async () => {
      mockMemberService.getMember.mockReturnValue(of(mockMember));
      
      fixture.detectChanges();
      await fixture.whenStable();
      
      const displayNameInput = fixture.nativeElement.querySelector('#displayName');
      expect(displayNameInput).toBeTruthy();
    });

    it('should display email as read-only', async () => {
      mockMemberService.getMember.mockReturnValue(of(mockMember));
      
      fixture.detectChanges();
      await fixture.whenStable();
      
      const emailInput = fixture.nativeElement.querySelector('input[type="email"][readonly]');
      expect(emailInput).toBeTruthy();
      expect(emailInput?.value).toBe('test@example.com');
    });

    it('should display profile photo', async () => {
      mockMemberService.getMember.mockReturnValue(of(mockMember));
      
      fixture.detectChanges();
      await fixture.whenStable();
      
      const profilePhoto = fixture.nativeElement.querySelector('img[alt="Profile photo"]');
      expect(profilePhoto).toBeTruthy();
      expect(profilePhoto?.src).toContain('/user.png');
    });

    it('should display upload photo button', async () => {
      mockMemberService.getMember.mockReturnValue(of(mockMember));
      
      fixture.detectChanges();
      await fixture.whenStable();
      
      const uploadButton = fixture.nativeElement.querySelector('label[for="photo-upload"]');
      expect(uploadButton).toBeTruthy();
    });
  });

  describe('Profile Update Flow', () => {
    beforeEach(() => {
      mockMemberService.getMember.mockReturnValue(of(mockMember));
      fixture.detectChanges();
    });

    it('should call memberService.updateMember with new display name', () => {
      const updatedMember = { ...mockMember, displayName: 'Updated Name' };
      mockMemberService.updateMember.mockReturnValue(of(updatedMember));
      
      component.form.displayName = 'Updated Name';
      component.save();
      
      expect(mockMemberService.updateMember).toHaveBeenCalledWith({
        displayName: 'Updated Name',
      });
    });

    it('should update account service current user after successful update', () => {
      const updatedMember = { ...mockMember, displayName: 'Updated Name' };
      mockMemberService.updateMember.mockReturnValue(of(updatedMember));
      
      component.form.displayName = 'Updated Name';
      component.save();
      
      expect(mockAccountService.currentUser()).toEqual({
        ...mockUser,
        displayName: 'Updated Name',
      });
    });

    it('should display success message after successful update', () => {
      const updatedMember = { ...mockMember, displayName: 'Updated Name' };
      mockMemberService.updateMember.mockReturnValue(of(updatedMember));
      
      component.form.displayName = 'Updated Name';
      component.save();
      
      expect(mockToastService.success).toHaveBeenCalledWith('Profile updated');
    });

    it('should set saving state to false after successful update', () => {
      const updatedMember = { ...mockMember, displayName: 'Updated Name' };
      mockMemberService.updateMember.mockReturnValue(of(updatedMember));
      
      component.form.displayName = 'Updated Name';
      component.save();
      
      expect(component.saving()).toBe(false);
    });
  });

  describe('Validation Errors', () => {
    beforeEach(() => {
      mockMemberService.getMember.mockReturnValue(of(mockMember));
      fixture.detectChanges();
    });

    it('should not save when display name is empty', () => {
      component.form.displayName = '';
      component.save();
      
      expect(mockMemberService.updateMember).not.toHaveBeenCalled();
    });

    it('should not save when display name is only whitespace', () => {
      component.form.displayName = '   ';
      component.save();
      
      expect(mockMemberService.updateMember).not.toHaveBeenCalled();
    });

    it('should trim whitespace from display name before saving', () => {
      const updatedMember = { ...mockMember, displayName: 'Trimmed Name' };
      mockMemberService.updateMember.mockReturnValue(of(updatedMember));
      
      component.form.displayName = '  Trimmed Name  ';
      component.save();
      
      expect(mockMemberService.updateMember).toHaveBeenCalledWith({
        displayName: 'Trimmed Name',
      });
    });

    it('should disable save button when display name is empty', async () => {
      component.form.displayName = '';
      fixture.detectChanges();
      await fixture.whenStable();
      
      const saveButton = fixture.nativeElement.querySelector('button.btn-primary');
      expect(saveButton?.disabled).toBe(true);
    });

    it('should disable save button when saving', async () => {
      component.saving.set(true);
      fixture.detectChanges();
      await fixture.whenStable();
      
      const saveButton = fixture.nativeElement.querySelector('button.btn-primary');
      expect(saveButton?.disabled).toBe(true);
    });
  });

  describe('Failed Update', () => {
    beforeEach(() => {
      mockMemberService.getMember.mockReturnValue(of(mockMember));
      fixture.detectChanges();
    });

    it('should display error message when update fails', () => {
      mockMemberService.updateMember.mockReturnValue(
        throwError(() => new Error('Update failed'))
      );
      
      component.form.displayName = 'Updated Name';
      component.save();
      
      expect(mockToastService.error).toHaveBeenCalledWith('Failed to save profile');
    });

    it('should set saving state to false after failed update', () => {
      mockMemberService.updateMember.mockReturnValue(
        throwError(() => new Error('Update failed'))
      );
      
      component.form.displayName = 'Updated Name';
      component.save();
      
      expect(component.saving()).toBe(false);
    });
  });

  describe('Photo Upload', () => {
    beforeEach(() => {
      mockMemberService.getMember.mockReturnValue(of(mockMember));
      fixture.detectChanges();
    });

    it('should call memberService.uploadPhoto with file', () => {
      const file = new File([''], 'test.jpg', { type: 'image/jpeg' });
      const updatedMember = { ...mockMember, imageUrl: '/new-photo.jpg' };
      mockMemberService.uploadPhoto.mockReturnValue(of(updatedMember));
      
      const event = {
        target: {
          files: [file],
        },
      } as any;
      
      component.onFileSelected(event);
      
      expect(mockMemberService.uploadPhoto).toHaveBeenCalledWith(file);
    });

    it('should update member photo after successful upload', () => {
      const file = new File([''], 'test.jpg', { type: 'image/jpeg' });
      const updatedMember = { ...mockMember, imageUrl: '/new-photo.jpg' };
      mockMemberService.uploadPhoto.mockReturnValue(of(updatedMember));
      
      const event = {
        target: {
          files: [file],
        },
      } as any;
      
      component.onFileSelected(event);
      
      expect(component.member()?.imageUrl).toBe('/new-photo.jpg');
    });

    it('should update account service current user photo after successful upload', () => {
      const file = new File([''], 'test.jpg', { type: 'image/jpeg' });
      const updatedMember = { ...mockMember, imageUrl: '/new-photo.jpg' };
      mockMemberService.uploadPhoto.mockReturnValue(of(updatedMember));
      
      const event = {
        target: {
          files: [file],
        },
      } as any;
      
      component.onFileSelected(event);
      
      expect(mockAccountService.currentUser().imageUrl).toBe('/new-photo.jpg');
    });

    it('should display success message after successful photo upload', () => {
      const file = new File([''], 'test.jpg', { type: 'image/jpeg' });
      const updatedMember = { ...mockMember, imageUrl: '/new-photo.jpg' };
      mockMemberService.uploadPhoto.mockReturnValue(of(updatedMember));
      
      const event = {
        target: {
          files: [file],
        },
      } as any;
      
      component.onFileSelected(event);
      
      expect(mockToastService.success).toHaveBeenCalledWith('Profile photo updated');
    });

    it('should display error message when photo upload fails', () => {
      const file = new File([''], 'test.jpg', { type: 'image/jpeg' });
      mockMemberService.uploadPhoto.mockReturnValue(
        throwError(() => new Error('Upload failed'))
      );
      
      const event = {
        target: {
          files: [file],
        },
      } as any;
      
      component.onFileSelected(event);
      
      expect(mockToastService.error).toHaveBeenCalledWith('Failed to upload photo');
    });

    it('should set uploadingPhoto state to false after upload completes', () => {
      const file = new File([''], 'test.jpg', { type: 'image/jpeg' });
      const updatedMember = { ...mockMember, imageUrl: '/new-photo.jpg' };
      mockMemberService.uploadPhoto.mockReturnValue(of(updatedMember));
      
      const event = {
        target: {
          files: [file],
        },
      } as any;
      
      component.onFileSelected(event);
      
      expect(component.uploadingPhoto()).toBe(false);
    });

    it('should not upload when no file is selected', () => {
      const event = {
        target: {
          files: [],
        },
      } as any;
      
      component.onFileSelected(event);
      
      expect(mockMemberService.uploadPhoto).not.toHaveBeenCalled();
    });
  });

  describe('Navigation', () => {
    beforeEach(() => {
      mockMemberService.getMember.mockReturnValue(of(mockMember));
      fixture.detectChanges();
    });

    it('should navigate to home when goBack is called', () => {
      component.goBack();
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/']);
    });

    it('should display back button', async () => {
      await fixture.whenStable();
      const backButton = Array.from(fixture.nativeElement.querySelectorAll('button')).find(
        (btn: any) => btn.textContent?.includes('Back')
      );
      expect(backButton).toBeTruthy();
    });
  });

  describe('Loading State', () => {
    it('should display error message when loading profile fails', () => {
      mockMemberService.getMember.mockReturnValue(
        throwError(() => new Error('Load failed'))
      );
      
      fixture.detectChanges();
      
      expect(mockToastService.error).toHaveBeenCalledWith('Failed to load profile');
    });

    it('should set loading state to false after profile loads', () => {
      mockMemberService.getMember.mockReturnValue(of(mockMember));
      
      fixture.detectChanges();
      
      expect(component.loading()).toBe(false);
    });

    it('should set loading state to false after load fails', () => {
      mockMemberService.getMember.mockReturnValue(
        throwError(() => new Error('Load failed'))
      );
      
      fixture.detectChanges();
      
      expect(component.loading()).toBe(false);
    });
  });
});
