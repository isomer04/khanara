import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-payment-success',
  imports: [],
  templateUrl: './payment-success.html',
})
export class PaymentSuccess implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private redirectTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit() {
    const orderId = this.route.snapshot.queryParamMap.get('orderId');
    if (!orderId) {
      this.router.navigate(['/orders']);
      return;
    }
    this.redirectTimer = setTimeout(() => {
      this.router.navigate(['/orders', orderId]);
    }, 2000);
  }

  ngOnDestroy() {
    if (this.redirectTimer) clearTimeout(this.redirectTimer);
  }
}
