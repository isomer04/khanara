import { Component, inject } from '@angular/core';
import { OrderHubService } from '../../core/services/order-hub-service';

@Component({
  selector: 'app-order-connection-status',
  template: `
    @if (hub.connectionState() === 'connecting' || hub.connectionState() === 'reconnecting') {
      <p role="status" class="text-sm text-gray-500 my-2">
        {{ hub.connectionState() === 'connecting' ? 'Connecting…' : 'Reconnecting…' }}
      </p>
    } @else if (hub.connectionState() === 'failed') {
      <div role="status" class="alert alert-warning my-2">
        <span>Live updates are unavailable.</span>
        <button type="button" class="btn btn-sm" (click)="hub.retry()">Retry connection</button>
      </div>
    }
  `,
})
export class OrderConnectionStatus {
  protected hub = inject(OrderHubService);
}
