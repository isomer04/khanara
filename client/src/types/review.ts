export type Review = {
  id: number;
  orderId: number;
  rating: number;
  comment?: string | null;
  authorDisplayName: string;
  authorPhotoUrl?: string | null;
  cookReply?: string | null;
  cookRepliedAt?: string | null;
  createdAt: string;
};

export type CreateReviewDto = {
  orderId: number;
  rating: number;
  comment?: string;
};

export type AddReplyDto = {
  reply: string;
};
