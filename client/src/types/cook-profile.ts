import { Dish } from './dish';

export type CookProfile = {
  id: number;
  appUserId: string;
  kitchenName: string;
  bio?: string;
  cuisineTags: CuisineTag[];
  serviceZipCodes: string[];
  kitchenPhotoUrl?: string;
  isAcceptingOrders: boolean;
  averageRating: number;
  reviewCount: number;
  createdAt: string;
  ownerDisplayName: string;
  dishes: Dish[];
};

export type CreateCookProfileDto = {
  kitchenName: string;
  bio?: string;
  cuisineTags: CuisineTag[];
  serviceZipCodes: string[];
};

export type UpdateCookProfileDto = {
  kitchenName?: string;
  bio?: string;
  cuisineTags?: CuisineTag[];
  serviceZipCodes?: string[];
  isAcceptingOrders?: boolean;
};

export enum CuisineTag {
  Bengali = 0,
  Indian = 1,
  Pakistani = 2,
  SriLankan = 3,
  Nepali = 4,
  Afghan = 5,
  Lebanese = 6,
  Syrian = 7,
  Yemeni = 8,
  Egyptian = 9,
  Turkish = 10,
  Thai = 11,
  Vietnamese = 12,
  Chinese = 13,
  Korean = 14,
  Filipino = 15,
  Malaysian = 16,
  Indonesian = 17,
  Other = 18
}

export const CuisineTagLabels: Record<CuisineTag, string> = {
  [CuisineTag.Bengali]: 'Bengali',
  [CuisineTag.Indian]: 'Indian',
  [CuisineTag.Pakistani]: 'Pakistani',
  [CuisineTag.SriLankan]: 'Sri Lankan',
  [CuisineTag.Nepali]: 'Nepali',
  [CuisineTag.Afghan]: 'Afghan',
  [CuisineTag.Lebanese]: 'Lebanese',
  [CuisineTag.Syrian]: 'Syrian',
  [CuisineTag.Yemeni]: 'Yemeni',
  [CuisineTag.Egyptian]: 'Egyptian',
  [CuisineTag.Turkish]: 'Turkish',
  [CuisineTag.Thai]: 'Thai',
  [CuisineTag.Vietnamese]: 'Vietnamese',
  [CuisineTag.Chinese]: 'Chinese',
  [CuisineTag.Korean]: 'Korean',
  [CuisineTag.Filipino]: 'Filipino',
  [CuisineTag.Malaysian]: 'Malaysian',
  [CuisineTag.Indonesian]: 'Indonesian',
  [CuisineTag.Other]: 'Other',
};
