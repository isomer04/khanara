import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { UserManagement } from './user-management';
import { AdminService } from '../../../core/services/admin-service';
import { buildUser } from '../../../testing/test-data-builders';

describe('UserManagement', () => {
  let component: UserManagement;
  let fixture: ComponentFixture<UserManagement>;
  let mockAdminService: any;

  beforeEach(async () => {
    mockAdminService = {
      getUserWithRoles: vi.fn().mockReturnValue(of([
        buildUser({ id: 1, email: 'user1@test.com', roles: ['Member'] }),
        buildUser({ id: 2, email: 'user2@test.com', roles: ['Member', 'Moderator'] }),
        buildUser({ id: 3, email: 'admin@test.com', roles: ['Admin', 'Member'] }),
      ])),
      updateUserRoles: vi.fn().mockReturnValue(of(['Member', 'Admin'])),
    };

    await TestBed.configureTestingModule({
      imports: [UserManagement],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AdminService, useValue: mockAdminService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UserManagement);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Initialization', () => {
    it('should load users with roles on init', () => {
      expect(mockAdminService.getUserWithRoles).toHaveBeenCalled();
      expect(component.users().length).toBe(3);
    });

    it('should display users in table', () => {
      const compiled = fixture.nativeElement;
      const rows = compiled.querySelectorAll('tbody tr');
      
      expect(rows.length).toBe(3);
      expect(rows[0].textContent).toContain('user1@test.com');
      expect(rows[1].textContent).toContain('user2@test.com');
      expect(rows[2].textContent).toContain('admin@test.com');
    });

    it('should display user roles in table', () => {
      const compiled = fixture.nativeElement;
      const rows = compiled.querySelectorAll('tbody tr');
      
      expect(rows[0].textContent).toContain('Member');
      expect(rows[1].textContent).toContain('Member,Moderator');
      expect(rows[2].textContent).toContain('Admin,Member');
    });

    it('should display edit roles button for each user', () => {
      const compiled = fixture.nativeElement;
      const buttons = compiled.querySelectorAll('tbody button');
      
      expect(buttons.length).toBe(3);
      buttons.forEach((button: Element) => {
        expect(button.textContent).toContain('Edit roles');
      });
    });
  });

  describe('Role Modal', () => {
    beforeEach(() => {
      // Mock the dialog element methods
      component.rolesModal = {
        nativeElement: {
          showModal: vi.fn(),
          close: vi.fn(),
        }
      } as any;
    });

    it('should open modal when openRolesModal is called', () => {
      const user = component.users()[0];
      
      component.openRolesModal(user);
      
      expect(component.rolesModal.nativeElement.showModal).toHaveBeenCalled();
      expect(component.selectedUser).toBeTruthy();
      expect(component.selectedUser?.email).toBe('user1@test.com');
    });

    it('should set selected user when opening modal', () => {
      const user = component.users()[1];
      
      component.openRolesModal(user);
      
      expect(component.selectedUser).toBe(user);
    });

    it('should display all available roles', () => {
      expect(component.availableRoles).toEqual(['Member', 'Moderator', 'Admin']);
    });
  });

  describe('Toggle Role', () => {
    beforeEach(() => {
      const user = component.users()[0];
      component.selectedUser = user;
    });

    it('should add role when checkbox is checked', () => {
      const event = { target: { checked: true } } as any;
      const initialRoles = [...component.selectedUser!.roles];
      
      component.toggleRole(event, 'Admin');
      
      expect(component.selectedUser!.roles).toContain('Admin');
      expect(component.selectedUser!.roles.length).toBe(initialRoles.length + 1);
    });

    it('should remove role when checkbox is unchecked', () => {
      component.selectedUser!.roles = ['Member', 'Moderator'];
      const event = { target: { checked: false } } as any;
      
      component.toggleRole(event, 'Member');
      
      expect(component.selectedUser!.roles).not.toContain('Member');
      expect(component.selectedUser!.roles).toEqual(['Moderator']);
    });

    it('should do nothing if no user is selected', () => {
      component.selectedUser = null;
      const event = { target: { checked: true } } as any;
      
      expect(() => component.toggleRole(event, 'Admin')).not.toThrow();
    });
  });

  describe('Update Roles', () => {
    beforeEach(() => {
      const user = component.users()[0];
      component.selectedUser = user;
      component.rolesModal = {
        nativeElement: {
          showModal: vi.fn(),
          close: vi.fn(),
        }
      } as any;
    });

    it('should call adminService.updateUserRoles with correct parameters', () => {
      component.selectedUser!.roles = ['Member', 'Admin'];
      
      component.updateRoles();
      
      expect(mockAdminService.updateUserRoles).toHaveBeenCalledWith(
        component.selectedUser!.id,
        ['Member', 'Admin']
      );
    });

    it('should update user roles in the list after successful update', async () => {
      // Clone the user to avoid mutating the same object
      const userFromList = component.users().find(u => u.id === component.selectedUser!.id);
      component.selectedUser = JSON.parse(JSON.stringify(userFromList));
      component.selectedUser!.roles = ['Member', 'Admin'];
      
      component.updateRoles();
      await fixture.whenStable();
      
      const updatedUser = component.users().find(u => u.id === component.selectedUser!.id);
      expect(updatedUser!.roles).toEqual(['Member', 'Admin']);
    });

    it('should close modal after successful update', async () => {
      component.updateRoles();
      await fixture.whenStable();
      
      expect(component.rolesModal.nativeElement.close).toHaveBeenCalled();
    });

    it('should handle error when update fails', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log');
      mockAdminService.updateUserRoles.mockReturnValue(
        throwError(() => new Error('Update failed'))
      );
      
      component.updateRoles();
      await fixture.whenStable();
      
      expect(consoleLogSpy).toHaveBeenCalledWith('Failed to update roles', expect.any(Error));
    });

    it('should do nothing if no user is selected', () => {
      component.selectedUser = null;
      
      expect(() => component.updateRoles()).not.toThrow();
      expect(mockAdminService.updateUserRoles).not.toHaveBeenCalled();
    });
  });
});
