import { Component, inject, output, signal, ViewEncapsulation } from '@angular/core';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { AccountService } from '../../../core/services/account-service';
import { TextInput } from '../../../shared/text-input/text-input';
import { Router, RouterLink } from '@angular/router';

/** Minimum age allowed to register (years). */
const MIN_AGE = 13;

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, TextInput, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.scss',
  encapsulation: ViewEncapsulation.None,
})
export class Register {
  private accountService = inject(AccountService);
  private router = inject(Router);
  private fb = inject(NonNullableFormBuilder);

  cancelRegister = output<boolean>();
  protected currentStep = signal(1);
  protected validationErrors = signal<string[]>([]);

  /** Organically scattered emoji items for the background field. */
  protected readonly emojiField = this.buildEmojiField();

  private buildEmojiField() {
    const emojis = ['🍛','🥘','🍜','🫕','🥗','🍱','🥙','🌮','🍲','🫔','🥞','🧆','🍣','🥟','🫓','🍤','🥮','🧁','🍮','🫙'];
    // Deterministic positions via a simple LCG — stable across renders, no Math.random()
    let s = 42;
    const rand = () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
    return Array.from({ length: 28 }, (_, i) => ({
      emoji: emojis[i % emojis.length],
      x: rand() * 100,
      y: rand() * 100,
      size: 1.2 + rand() * 2.2,
      opacity: 0.04 + rand() * 0.1,
      rotate: rand() * 40 - 20,
    }));
  }

  /** The latest date of birth allowed (today minus MIN_AGE years). */
  protected readonly maxDob = this.calcMaxDob();

  // ── Forms ─────────────────────────────────────────────────────────────────

  protected credentialsForm = this.fb.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    displayName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
    password: ['', [
      Validators.required,
      Validators.minLength(12),
      Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/),
    ]],
    confirmPassword: ['', [Validators.required, this.matchValues('password')]],
  });

  // updateOn: 'blur' — validate only when the user leaves a field, not on every keystroke.
  protected profileForm = this.fb.group({
    gender: ['male', Validators.required],
    dateOfBirth: ['', { validators: [Validators.required, this.minAgeValidator(MIN_AGE)], updateOn: 'blur' }],
    city: ['', { validators: [Validators.required, Validators.maxLength(100)], updateOn: 'blur' }],
    country: ['', { validators: [Validators.required, Validators.maxLength(100)], updateOn: 'blur' }],
  });

  constructor() {
    // Re-validate confirmPassword whenever password changes.
    this.credentialsForm.controls.password.valueChanges.subscribe(() => {
      this.credentialsForm.controls.confirmPassword.updateValueAndValidity();
    });
  }

  // ── Typed control getters (cleaner template access + full type safety) ────

  get email() { return this.credentialsForm.controls.email; }
  get displayName() { return this.credentialsForm.controls.displayName; }
  get password() { return this.credentialsForm.controls.password; }
  get confirmPassword() { return this.credentialsForm.controls.confirmPassword; }
  get dateOfBirth() { return this.profileForm.controls.dateOfBirth; }
  get city() { return this.profileForm.controls.city; }
  get country() { return this.profileForm.controls.country; }

  // ── Validators ────────────────────────────────────────────────────────────

  matchValues(matchTo: string): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const parent = control.parent;
      if (!parent) return null;
      return control.value === parent.get(matchTo)?.value ? null : { passwordMismatch: true };
    };
  }

  minAgeValidator(minAge: number): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) return null;
      const dob = new Date(control.value);
      if (isNaN(dob.getTime())) return { invalidDate: true };
      const cutoff = new Date();
      cutoff.setFullYear(cutoff.getFullYear() - minAge);
      return dob <= cutoff ? null : { tooYoung: { requiredAge: minAge } };
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private calcMaxDob(): string {
    const d = new Date();
    d.setFullYear(d.getFullYear() - MIN_AGE);
    return d.toISOString().split('T')[0];
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  nextStep() {
    if (this.credentialsForm.invalid) {
      this.credentialsForm.markAllAsTouched();
      return;
    }
    this.currentStep.update(s => s + 1);
  }

  prevStep() {
    this.currentStep.update(s => s - 1);
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  register() {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }
    if (this.credentialsForm.invalid) {
      this.currentStep.set(1);
      this.credentialsForm.markAllAsTouched();
      return;
    }

    // getRawValue() returns a fully typed, non-partial value that includes
    // any disabled controls — safer than spreading .value directly.
    const formData = {
      ...this.credentialsForm.getRawValue(),
      ...this.profileForm.getRawValue(),
    };

    this.accountService.register(formData).subscribe({
      next: () => this.router.navigateByUrl('/cooks'),
      error: (error: string[]) => this.validationErrors.set(error),
    });
  }

  cancel() {
    this.cancelRegister.emit(false);
    this.router.navigateByUrl('/');
  }
}