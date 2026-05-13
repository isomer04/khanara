import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CurrencyPipe } from '@angular/common';
import { CartService } from '../../../core/services/cart-service';
import { OrderService } from '../../../core/services/order-service';
import { ToastService } from '../../../core/services/toast-service';
import { FulfillmentType, PaymentMethod } from '../../../types/order';

@Component({
  selector: 'app-checkout',
  imports: [RouterLink, FormsModule, CurrencyPipe],
  templateUrl: './checkout.html',
})
export class Checkout implements OnInit {
  protected cartService = inject(CartService);
  private orderService = inject(OrderService);
  private router = inject(Router);
  private toast = inject(ToastService);

  protected FulfillmentType = FulfillmentType;
  protected PaymentMethod = PaymentMethod;
  protected fulfillmentType = signal<FulfillmentType>(FulfillmentType.Pickup);
  protected paymentMethod = signal<PaymentMethod>(PaymentMethod.Cash);
  protected notes = signal('');
  protected submitting = signal(false);

  ngOnInit() {
    if (this.cartService.itemCount() === 0) {
      this.router.navigate(['/cooks']);
    }
  }

  setFulfillment(type: FulfillmentType) {
    this.fulfillmentType.set(type);
  }

  setPaymentMethod(method: PaymentMethod) {
    this.paymentMethod.set(method);
  }

  placeOrder() {
    const cookProfileId = this.cartService.cookProfileId();
    if (!cookProfileId) return;

    this.submitting.set(true);
    const dto = {
      cookProfileId,
      items: this.cartService.items().map(i => ({ dishId: i.dishId, quantity: i.quantity })),
      fulfillmentType: this.fulfillmentType(),
      paymentMethod: this.paymentMethod(),
      notes: this.notes() || undefined,
    };

    this.orderService.placeOrder(dto).subscribe({
      next: order => {
        if (this.paymentMethod() === PaymentMethod.Stripe) {
          this.orderService.createCheckoutSession(order.id).subscribe({
            next: ({ sessionUrl }) => {
              this.cartService.clear();
              window.location.href = sessionUrl;
            },
            error: () => {
              this.submitting.set(false);
              this.toast.error('Could not start payment. Your order was saved — try again from your orders page.');
              this.router.navigate(['/orders', order.id]);
            }
          });
        } else {
          this.cartService.clear();
          this.toast.success('Order placed!');
          this.router.navigate(['/orders', order.id]);
        }
      },
      error: () => {
        this.submitting.set(false);
        this.toast.error('Failed to place order');
      },
    });
  }
}
