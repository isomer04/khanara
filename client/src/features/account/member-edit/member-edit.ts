import { Component, inject, OnInit, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { NgOptimizedImage } from '@angular/common';
import { Router } from '@angular/router';
import { MemberService, MemberProfile } from '../../../core/services/member-service';
import { AccountService } from '../../../core/services/account-service';
import { ToastService } from '../../../core/services/toast-service';

@Component({
  selector: 'app-member-edit',
  imports: [FormsModule, NgOptimizedImage],
  templateUrl: './member-edit.html',
})
export class MemberEdit implements OnInit {
  private memberService = inject(MemberService);
  private accountService = inject(AccountService);
  private toast = inject(ToastService);
  private router = inject(Router);

  protected member = signal<MemberProfile | null>(null);
  protected loading = signal(false);
  protected saving = signal(false);
  protected uploadingPhoto = signal(false);

  protected form = {
    displayName: '',
  };

  ngOnInit() {
    const user = this.accountService.currentUser();
    if (!user) return;

    this.loading.set(true);
    this.memberService.getMember(user.id).pipe(
      finalize(() => this.loading.set(false))
    ).subscribe({
      next: m => {
        this.member.set(m);
        this.form.displayName = m.displayName;
      },
      error: () => this.toast.error('Failed to load profile'),
    });
  }

  save() {
    if (!this.form.displayName.trim()) return;

    this.saving.set(true);
    this.memberService.updateMember({ displayName: this.form.displayName.trim() }).pipe(
      finalize(() => this.saving.set(false))
    ).subscribe({
      next: updated => {
        // Keep the account service current user in sync.
        const user = this.accountService.currentUser();
        if (user) this.accountService.currentUser.set({ ...user, displayName: updated.displayName });
        this.toast.success('Profile updated');
      },
      error: () => this.toast.error('Failed to save profile'),
    });
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.uploadingPhoto.set(true);
    this.memberService.uploadPhoto(file).pipe(
      finalize(() => this.uploadingPhoto.set(false))
    ).subscribe({
      next: updated => {
        const user = this.accountService.currentUser();
        if (user) this.accountService.currentUser.set({ ...user, imageUrl: updated.imageUrl });
        this.member.set(updated);
        this.toast.success('Profile photo updated');
      },
      error: () => this.toast.error('Failed to upload photo'),
    });
  }

  goBack() {
    this.router.navigate(['/']);
  }
}
