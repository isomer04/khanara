import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { Admin } from './admin';
import { AccountService } from '../../core/services/account-service';
import { buildUser } from '../../testing/test-data-builders';

describe('Admin', () => {
  let component: Admin;
  let fixture: ComponentFixture<Admin>;
  let mockAccountService: any;

  beforeEach(async () => {
    mockAccountService = {
      currentUser: signal(buildUser({ roles: ['Admin', 'Moderator'] })),
    };

    await TestBed.configureTestingModule({
      imports: [Admin],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AccountService, useValue: mockAccountService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Admin);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Tab Navigation', () => {
    it('should initialize with photos tab active', () => {
      expect(component.activeTab).toBe('photos');
    });

    it('should display both tabs for admin users', () => {
      const compiled = fixture.nativeElement;
      const tabs = compiled.querySelectorAll('.tab');
      
      expect(tabs.length).toBe(2);
      expect(tabs[0].textContent.trim()).toBe('Photo moderation');
      expect(tabs[1].textContent.trim()).toBe('User management');
    });

    it('should hide roles tab for non-admin users', async () => {
      mockAccountService.currentUser.set(buildUser({ roles: ['Moderator'] }));
      fixture.detectChanges();
      await fixture.whenStable();

      const compiled = fixture.nativeElement;
      const rolesTab = Array.from(compiled.querySelectorAll('.tab')).find(
        (tab: any) => tab.textContent.includes('User management')
      ) as HTMLElement;

      expect(rolesTab?.hidden).toBe(true);
    });

    it('should switch to roles tab when setTab is called', () => {
      component.setTab('roles');
      expect(component.activeTab).toBe('roles');
    });

    it('should switch to photos tab when setTab is called', () => {
      component.setTab('photos');
      expect(component.activeTab).toBe('photos');
    });

    it('should mark active tab with tab-active class', () => {
      const compiled = fixture.nativeElement;
      const activeTab = compiled.querySelector('.tab.tab-active');
      
      expect(activeTab).toBeTruthy();
      expect(activeTab.textContent.trim()).toBe('Photo moderation');
    });
  });

  describe('Component Rendering', () => {
    it('should render photo management component when photos tab is active', () => {
      component.activeTab = 'photos';
      fixture.detectChanges();

      const compiled = fixture.nativeElement;
      const photoManagement = compiled.querySelector('app-photo-management');
      
      expect(photoManagement).toBeTruthy();
    });

    it('should not render user management when photos tab is active', () => {
      component.setTab('photos');
      fixture.detectChanges();

      const compiled = fixture.nativeElement;
      const userManagement = compiled.querySelector('app-user-management');
      
      expect(userManagement).toBeFalsy();
    });
  });

  describe('setTab method', () => {
    it('should update activeTab when setTab is called', () => {
      component.setTab('roles');
      expect(component.activeTab).toBe('roles');

      component.setTab('photos');
      expect(component.activeTab).toBe('photos');
    });
  });
});
