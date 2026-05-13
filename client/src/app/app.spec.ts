import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { EMPTY } from 'rxjs';
import { App } from './app';
import { AccountService } from '../core/services/account-service';
import { ToastService } from '../core/services/toast-service';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        {
          provide: AccountService,
          useValue: { currentUser: () => null, login: () => EMPTY, logout: () => {} },
        },
        { provide: ToastService, useValue: { error: () => {}, success: () => {} } },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });
});
