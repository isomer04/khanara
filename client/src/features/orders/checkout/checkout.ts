import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CurrencyPipe } from '@angular/common';
import { CartService } from '../../../core/services/cart-service';
import { OrderService } from '../../../core/services/order-service';
import { CookService } from '../../../core/services/cook-service';
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
  private cookService = inject(CookService);
  private router = inject(Router);
  private toast = inject(ToastService);

  protected FulfillmentType = FulfillmentType;
  protected PaymentMethod = PaymentMethod;
  protected fulfillmentType = signal<FulfillmentType>(FulfillmentType.Pickup);
  protected paymentMethod = signal<PaymentMethod>(PaymentMethod.Cash);
  protected notes = signal('');
  protected deliveryAddress = signal('');
  protected deliveryZipCode = signal('');
  protected submitting = signal(false);
  protected kitchenName = signal('');
  // null until the cook's profile loads
  protected serviceZipCodes = signal<string[] | null>(null);
  protected offersDelivery = computed(() => (this.serviceZipCodes()?.length ?? 0) > 0);

  protected deliveryError = computed(() => {
    if (this.fulfillmentType() !== FulfillmentType.Delivery) return null;
    const zip = this.deliveryZipCode().trim();
    if (!this.deliveryAddress().trim() || !zip) return 'Enter your delivery address and zip code';
    if (!/^\d{5}$/.test(zip)) return 'Zip code must be 5 digits';
    const zips = this.serviceZipCodes();
    if (zips && !zips.includes(zip)) return `${this.kitchenName()} doesn't deliver to ${zip}`;
    return null;
  });

  ngOnInit() {
    if (this.cartService.itemCount() === 0) {
      this.router.navigate(['/cooks']);
      return;
    }

    const cookProfileId = this.cartService.cookProfileId();
    if (cookProfileId) {
      this.cookService.getCook(cookProfileId).subscribe({
        next: cook => {
          this.kitchenName.set(cook.kitchenName);
          this.serviceZipCodes.set(cook.serviceZipCodes);
        },
        error: () => this.toast.error("Couldn't load delivery options. Pickup is still available."),
      });
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

    const deliveryError = this.deliveryError();
    if (deliveryError) {
      this.toast.error(deliveryError);
      return;
    }

    const isDelivery = this.fulfillmentType() === FulfillmentType.Delivery;
    this.submitting.set(true);
    const dto = {
      cookProfileId,
      items: this.cartService.items().map(i => ({ dishId: i.dishId, quantity: i.quantity })),
      fulfillmentType: this.fulfillmentType(),
      paymentMethod: this.paymentMethod(),
      notes: this.notes() || undefined,
      deliveryAddress: isDelivery ? this.deliveryAddress().trim() : undefined,
      deliveryZipCode: isDelivery ? this.deliveryZipCode().trim() : undefined,
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
      // The error interceptor already toasts plain 400s (e.g. "not enough portions")
      error: err => {
        this.submitting.set(false);
        if (Array.isArray(err)) this.toast.error(err.join(' '));
      },
    });
  }
}
