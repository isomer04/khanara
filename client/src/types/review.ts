export type Review = {
  id: number;
  orderId: number;
  rating: number;
  comment?: string | null;
  authorDisplayName: string;
  authorImageUrl?: string | null;
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
