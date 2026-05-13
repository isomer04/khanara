import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { Register } from './register';
import { AccountService } from '../../../core/services/account-service';
import { User } from '../../../types/user';

const fakeUser: User = {
  id: 'u1',
  displayName: 'Test',
  email: 'test@khanara.dev',
  token: 'hdr.payload.sig',
  roles: [],
};

describe('Register', () => {
  let component: Register;
  let fixture: ComponentFixture<Register>;
  let mockAccountService: { register: ReturnType<typeof vi.fn> };
  let mockRouter: Router;

  beforeEach(async () => {
    mockAccountService = { register: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [Register],
      providers: [
        provideRouter([]),
        { provide: AccountService, useValue: mockAccountService },
      ],
    }).compileComponents();

    mockRouter = TestBed.inject(Router);
    vi.spyOn(mockRouter, 'navigateByUrl').mockResolvedValue(true);

    fixture = TestBed.createComponent(Register);
    component = fixture.componentInstance;
    // Access forms from constructor without triggering template rendering
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('starts on step 1', () => {
    expect(component['currentStep']()).toBe(1);
  });

  // ── Credentials form validators ───────────────────────────────────────────

  it('credentialsForm is invalid when empty', () => {
    expect(component['credentialsForm'].invalid).toBe(true);
  });

  it('email must be required', () => {
    const ctrl = component['credentialsForm'].get('email')!;
    expect(ctrl.hasError('required')).toBe(true);
  });

  it('email must be a valid address', () => {
    const ctrl = component['credentialsForm'].get('email')!;
    ctrl.setValue('not-an-email');
    expect(ctrl.hasError('email')).toBe(true);
    ctrl.setValue('user@khanara.dev');
    expect(ctrl.hasError('email')).toBe(false);
  });

  it('password requires at least 12 characters', () => {
    const ctrl = component['credentialsForm'].get('password')!;
    ctrl.setValue('Short1');
    expect(ctrl.hasError('minlength')).toBe(true);
    ctrl.setValue('LongEnough123');
    expect(ctrl.hasError('minlength')).toBe(false);
  });

  it('password fails pattern without an uppercase letter', () => {
    const ctrl = component['credentialsForm'].get('password')!;
    ctrl.setValue('alllowercase123');
    expect(ctrl.hasError('pattern')).toBe(true);
  });

  it('password fails pattern without a digit', () => {
    const ctrl = component['credentialsForm'].get('password')!;
    ctrl.setValue('AllUpperNoDigits!');
    expect(ctrl.hasError('pattern')).toBe(true);
  });

  it('password passes with uppercase, lowercase, and digit', () => {
    const ctrl = component['credentialsForm'].get('password')!;
    ctrl.setValue('ValidPass123');
    expect(ctrl.valid).toBe(true);
  });

  it('confirmPassword detects mismatch', () => {
    const form = component['credentialsForm'];
    form.get('password')!.setValue('ValidPass123');
    form.get('confirmPassword')!.setValue('DifferentPass123');
    expect(form.get('confirmPassword')!.hasError('passwordMismatch')).toBe(true);
  });

  it('confirmPassword is valid when passwords match', () => {
    const form = component['credentialsForm'];
    form.get('password')!.setValue('ValidPass123');
    form.get('confirmPassword')!.setValue('ValidPass123');
    expect(form.get('confirmPassword')!.hasError('passwordMismatch')).toBe(false);
  });

  // ── Step navigation ───────────────────────────────────────────────────────

  it('nextStep does not advance when credentialsForm is invalid', () => {
    component['nextStep']();
    expect(component['currentStep']()).toBe(1);
  });

  it('nextStep advances to step 2 when credentialsForm is valid', () => {
    const form = component['credentialsForm'];
    form.get('email')!.setValue('test@khanara.dev');
    form.get('displayName')!.setValue('Test User');
    form.get('password')!.setValue('ValidPass123');
    form.get('confirmPassword')!.setValue('ValidPass123');

    component['nextStep']();
    expect(component['currentStep']()).toBe(2);
  });

  it('prevStep goes back from step 2 to step 1', () => {
    component['currentStep'].set(2);
    component['prevStep']();
    expect(component['currentStep']()).toBe(1);
  });

  it('cancel navigates to /', () => {
    component['cancel']();
    expect(mockRouter.navigateByUrl).toHaveBeenCalledWith('/');
  });

  // ── Registration submission ───────────────────────────────────────────────

  const fillForms = () => {
    const cf = component['credentialsForm'];
    cf.get('email')!.setValue('test@khanara.dev');
    cf.get('displayName')!.setValue('Test User');
    cf.get('password')!.setValue('ValidPass123');
    cf.get('confirmPassword')!.setValue('ValidPass123');

    const pf = component['profileForm'];
    pf.get('gender')!.setValue('male');
    pf.get('dateOfBirth')!.setValue('2000-01-01');
    pf.get('city')!.setValue('New York');
    pf.get('country')!.setValue('USA');
  };

  it('calls accountService.register when both forms are valid', () => {
    mockAccountService.register.mockReturnValue(of(fakeUser));
    fillForms();
    component['register']();
    expect(mockAccountService.register).toHaveBeenCalledOnce();
    expect(mockAccountService.register).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'test@khanara.dev' })
    );
  });

  it('navigates to /cooks on successful registration', () => {
    mockAccountService.register.mockReturnValue(of(fakeUser));
    fillForms();
    component['register']();
    expect(mockRouter.navigateByUrl).toHaveBeenCalledWith('/cooks');
  });

  it('sets validationErrors on registration failure', () => {
    const errors = ['Password is too weak', 'Email already taken'];
    mockAccountService.register.mockReturnValue(throwError(() => errors));
    fillForms();
    component['register']();
    expect(component['validationErrors']()).toEqual(errors);
  });

  it('does not call register when credentialsForm is invalid', () => {
    component['register']();
    expect(mockAccountService.register).not.toHaveBeenCalled();
  });

  it('getMaxDate returns a date at least 13 years ago', () => {
    const maxDate = component['maxDob'];
    const parsed = new Date(maxDate);
    const thirteenYearsAgo = new Date();
    thirteenYearsAgo.setFullYear(thirteenYearsAgo.getFullYear() - 13);
    expect(parsed.getFullYear()).toBe(thirteenYearsAgo.getFullYear());
  });
});
