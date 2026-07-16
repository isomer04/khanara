import { CuisineTag } from './cook-profile';

export type FavoriteDto = {
  cookProfileId: number;
  kitchenName: string;
  kitchenPhotoUrl?: string | null;
  averageRating: number;
  reviewCount: number;
  isAcceptingOrders: boolean;
  favoritedAt: string;
};

export type DiscoveryCookDto = {
  id: number;
  kitchenName: string;
  kitchenPhotoUrl?: string | null;
  averageRating: number;
  reviewCount: number;
  isAcceptingOrders: boolean;
  cuisineTags: CuisineTag[];
  serviceZipCodes: string[];
  createdAt: string;
};
