export type OrderMessage = {
  id: number;
  orderId: number;
  senderId: string;
  senderDisplayName: string;
  content: string;
  sentAt: string;
};

export type OrderStatusChanged = {
  orderId: number;
  oldStatus: string;
  newStatus: string;
  changedAt: string;
};

export type OrderPresence = {
  orderId: number;
  cookOnline: boolean;
  eaterOnline: boolean;
};
