import { inject, Injectable, SecurityContext } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  private router = inject(Router);
  private sanitizer = inject(DomSanitizer);

  constructor() {
    this.createToastContainer();
  }

  private createToastContainer() {
    if (!document.getElementById('toast-container')) {
      const container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast toast-bottom toast-end z-50';
      document.body.appendChild(container);
    }
  }

  private createToastElement(
    message: string,
    alertClass: string,
    duration = 5000,
    imageUrl?: string,
    route?: string,
  ) {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.classList.add(
      'alert',
      alertClass,
      'shadow-lg',
      'flex',
      'items-center',
      'gap-3',
      'cursor-pointer',
    );

    if (route) {
      toast.addEventListener('click', () => this.router.navigateByUrl(route));
    }

    if (imageUrl) {
      const safeImageUrl =
        this.sanitizer.sanitize(SecurityContext.URL, imageUrl) || '/user.png';
      const img = document.createElement('img');
      img.src = safeImageUrl;
      img.className = 'w-10 h-10 rounded';
      img.alt = '';
      toast.appendChild(img);
    }

    const text = document.createElement('span');
    text.textContent = message;
    toast.appendChild(text);

    const closeButton = document.createElement('button');
    closeButton.className = 'ml-4 btn btn-sm btn-ghost';
    closeButton.textContent = 'x';
    closeButton.setAttribute('aria-label', 'Close notification');
    closeButton.addEventListener('click', (event) => {
      event.stopPropagation();
      toastContainer.removeChild(toast);
    });
    toast.appendChild(closeButton);

    toastContainer.append(toast);

    setTimeout(() => {
      if (toastContainer.contains(toast)) {
        toastContainer.removeChild(toast);
      }
    }, duration);
  }

  success(message: string, duration?: number, imageUrl?: string, route?: string) {
    this.createToastElement(message, 'alert-success', duration, imageUrl, route);
  }

  error(message: string, duration?: number, imageUrl?: string, route?: string) {
    this.createToastElement(message, 'alert-error', duration, imageUrl, route);
  }

  warning(message: string, duration?: number, imageUrl?: string, route?: string) {
    this.createToastElement(message, 'alert-warning', duration, imageUrl, route);
  }

  info(message: string, duration?: number, imageUrl?: string, route?: string) {
    this.createToastElement(message, 'alert-info', duration, imageUrl, route);
  }
}
