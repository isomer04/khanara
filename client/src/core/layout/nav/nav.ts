import { Component, DestroyRef, inject, OnInit, signal, ViewEncapsulation } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AccountService } from '../../services/account-service';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { ToastService } from '../../services/toast-service';
import { themes } from '../theme';
import { BusyService } from '../../services/busy-service';
import { HasRole } from '../../../shared/directives/has-role';
import { CartService } from '../../services/cart-service';
import { TextInput } from '../../../shared/text-input/text-input';
import { NgOptimizedImage } from '@angular/common';

@Component({
  selector: 'app-nav',
  imports: [ReactiveFormsModule, RouterLink, RouterLinkActive, HasRole, TextInput, NgOptimizedImage],
  templateUrl: './nav.html',
  styleUrl: './nav.scss',
  encapsulation: ViewEncapsulation.None,
})
export class Nav implements OnInit {
  protected accountService = inject(AccountService);
  protected busyService = inject(BusyService);
  protected cartService = inject(CartService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);
  private toast = inject(ToastService);
  private fb = inject(NonNullableFormBuilder);

  selectedTheme = signal<string>(localStorage.getItem('theme') || 'khanara');
  protected themes = themes;
  loading = signal(false);
  mobileMenuOpen = signal(false);

  protected loginOpen = signal(false);
  private returnUrl: string | null = null;

  protected loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', { validators: [Validators.required, Validators.minLength(6)], updateOn: 'blur' }],
  });

  get emailControl() { return this.loginForm.controls.email; }
  get passwordControl() { return this.loginForm.controls.password; }

  /** Organically scattered emoji items for the login background. */
  protected readonly loginEmojiField = this.buildEmojiField(99);

  private buildEmojiField(seed: number) {
    const emojis = ['🍛','🥘','🍜','🫕','🥗','🍱','🥙','🌮','🍲','🫔','🥞','🧆','🍣','🥟','🫓','🍤','🥮','🧁','🍮','🫙'];
    let s = seed;
    const rand = () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
    return Array.from({ length: 22 }, (_, i) => ({
      emoji: emojis[i % emojis.length],
      x: rand() * 100,
      y: rand() * 100,
      size: 1.2 + rand() * 2.2,
      opacity: 0.04 + rand() * 0.1,
      rotate: rand() * 40 - 20,
    }));
  }

  ngOnInit(): void {
    document.documentElement.setAttribute('data-theme', this.selectedTheme());

    // authGuard and anonymous "add to order" send people to /?login=1&returnUrl=...
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      if (params.get('login') !== '1') return;

      this.router.navigate([], {
        queryParams: { login: null, returnUrl: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
      if (this.accountService.currentUser()) return;

      const returnUrl = params.get('returnUrl');
      // Only same-app paths; "//host" would be protocol-relative
      this.returnUrl = returnUrl?.startsWith('/') && !returnUrl.startsWith('//') ? returnUrl : null;
      this.openLoginModal();
    });
  }

  openLoginModal() {
    this.loginOpen.set(true);
    // Prevent body scroll while overlay is open
    document.body.style.overflow = 'hidden';
  }

  closeLoginModal() {
    this.loginOpen.set(false);
    this.returnUrl = null;
    document.body.style.overflow = '';
    this.loginForm.reset();
  }

  handleSelectTheme(theme: string) {
    this.selectedTheme.set(theme);
    localStorage.setItem('theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    const elem = document.activeElement as HTMLElement;
    if (elem) elem.blur();
  }

  handleSelectUserItem() {
    const elem = document.activeElement as HTMLDivElement;
    if (elem) elem.blur();
  }

  login() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    // On failure the error interceptor toasts the server's message
    this.accountService.login(this.loginForm.getRawValue()).pipe(
      finalize(() => this.loading.set(false))
    ).subscribe({
      next: () => {
        const returnUrl = this.returnUrl;
        this.closeLoginModal();
        this.router.navigateByUrl(returnUrl ?? '/cooks');
        this.toast.success('Logged in successfully');
      },
      error: () => {},
    });
  }

  logout() {
    this.accountService.logout();
    this.router.navigateByUrl('/');
  }
}
