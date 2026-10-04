import { Component, inject } from '@angular/core';
import { OrderHubService } from '../../core/services/order-hub-service';

@Component({
  selector: 'app-order-connection-status',
  templateUrl: './order-connection-status.html',
})
export class OrderConnectionStatus {
  private hub = inject(OrderHubService);

  protected connectionState = this.hub.connectionState.asReadonly();

  retry() {
    this.hub.retry();
  }
}
