import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CookService } from '../../../core/services/cook-service';
import { AccountService } from '../../../core/services/account-service';
import { ToastService } from '../../../core/services/toast-service';
import { CuisineTag, CuisineTagLabels } from '../../../types/cook-profile';

@Component({
  selector: 'app-cook-onboarding',
  imports: [FormsModule],
  templateUrl: './cook-onboarding.html',
})
export class CookOnboarding {
  private cookService = inject(CookService);
  private accountService = inject(AccountService);
  private router = inject(Router);
  private toast = inject(ToastService);

  protected loading = signal(false);
  protected cuisineTags = Object.entries(CuisineTagLabels).map(([key, label]) => ({
    value: Number(key) as CuisineTag,
    label,
  }));

  protected form = {
    kitchenName: '',
    bio: '',
    selectedCuisineTags: [] as CuisineTag[],
    serviceZipCodesRaw: '',
  };

  toggleCuisineTag(tag: CuisineTag) {
    const idx = this.form.selectedCuisineTags.indexOf(tag);
    if (idx === -1) {
      this.form.selectedCuisineTags = [...this.form.selectedCuisineTags, tag];
    } else {
      this.form.selectedCuisineTags = this.form.selectedCuisineTags.filter(t => t !== tag);
    }
  }

  isTagSelected(tag: CuisineTag) {
    return this.form.selectedCuisineTags.includes(tag);
  }

  submit() {
    if (!this.form.kitchenName.trim()) {
      this.toast.error('Kitchen name is required');
      return;
    }
    if (this.form.selectedCuisineTags.length === 0) {
      this.toast.error('Select at least one cuisine');
      return;
    }

    const zipCodes = this.form.serviceZipCodesRaw
      .split(',')
      .map(z => z.trim())
      .filter(z => z.length > 0);

    this.loading.set(true);
    this.cookService.createCookProfile({
      kitchenName: this.form.kitchenName,
      bio: this.form.bio || undefined,
      cuisineTags: this.form.selectedCuisineTags,
      serviceZipCodes: zipCodes,
    }).subscribe({
      next: () => {
        const user = this.accountService.currentUser();
        if (user) {
          user.roles = [...user.roles, 'Cook'];
          this.accountService.currentUser.set({ ...user });
        }
        this.toast.success('Welcome to Khanara! Your kitchen is ready.');
        this.router.navigateByUrl('/cook/dashboard');
      },
      error: err => this.toast.error(err.error),
      complete: () => this.loading.set(false),
    });
  }
}
