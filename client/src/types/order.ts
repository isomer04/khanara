export enum OrderStatus {
  Pending   = 0,
  Accepted  = 1,
  Preparing = 2,
  Ready     = 3,
  Delivered = 4,
  Cancelled = 5,
}

export const OrderStatusLabels: Record<OrderStatus, string> = {
  [OrderStatus.Pending]:   'Pending',
  [OrderStatus.Accepted]:  'Accepted',
  [OrderStatus.Preparing]: 'Preparing',
  [OrderStatus.Ready]:     'Ready',
  [OrderStatus.Delivered]: 'Delivered',
  [OrderStatus.Cancelled]: 'Cancelled',
};

export enum PaymentMethod {
  Cash   = 0,
  Stripe = 1,
}

export enum PaymentStatus {
  Pending  = 0,
  Paid     = 1,
  Refunded = 2,
}

export enum FulfillmentType {
  Pickup   = 0,
  Delivery = 1,
}

export type OrderItem = {
  id: number;
  dishId: number;
  dishName: string;
  quantity: number;
  unitPriceSnapshot: number;
};

export type Order = {
  id: number;
  eaterUserId: string;
  eaterDisplayName: string;
  cookProfileId: number;
  cookKitchenName: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  fulfillmentType: FulfillmentType;
  totalAmount: number;
  scheduledFor?: string;
  notes?: string;
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
};

export type CreateOrderDto = {
  cookProfileId: number;
  items: { dishId: number; quantity: number }[];
  fulfillmentType: FulfillmentType;
  paymentMethod: PaymentMethod;
  scheduledFor?: string;
  notes?: string;
};

export type UpdateOrderStatusDto = {
  newStatus: OrderStatus;
};

export type CancelOrderDto = {
  reason: string;
};

export type CartItem = {
  dishId: number;
  dishName: string;
  price: number;
  quantity: number;
};
