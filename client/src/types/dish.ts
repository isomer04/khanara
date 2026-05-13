import { CuisineTag } from './cook-profile';

export type Dish = {
  id: number;
  cookProfileId: number;
  name: string;
  description?: string;
  price: number;
  cuisineTag: CuisineTag;
  dietaryTags: DietaryTags;
  portionsPerBatch: number;
  portionsRemainingToday: number;
  isAvailable: boolean;
  createdAt: string;
  photos: DishPhoto[];
};

export type DishPhoto = {
  id: number;
  url: string;
  isMain: boolean;
};

export type CreateDishDto = {
  name: string;
  description?: string;
  price: number;
  cuisineTag: CuisineTag;
  dietaryTags: DietaryTags;
  portionsPerBatch: number;
};

export type UpdateDishDto = {
  name?: string;
  description?: string;
  price?: number;
  cuisineTag?: CuisineTag;
  dietaryTags?: DietaryTags;
  portionsPerBatch?: number;
  portionsRemainingToday?: number;
  isAvailable?: boolean;
};

export enum DietaryTags {
  None          = 0,
  Halal         = 1,
  Vegetarian    = 2,
  Vegan         = 4,
  GlutenFree    = 8,
  ContainsNuts  = 16,
  ContainsDairy = 32
}

export const DietaryTagLabels: { flag: DietaryTags; label: string }[] = [
  { flag: DietaryTags.Halal, label: 'Halal' },
  { flag: DietaryTags.Vegetarian, label: 'Vegetarian' },
  { flag: DietaryTags.Vegan, label: 'Vegan' },
  { flag: DietaryTags.GlutenFree, label: 'Gluten Free' },
  { flag: DietaryTags.ContainsNuts, label: 'Contains Nuts' },
  { flag: DietaryTags.ContainsDairy, label: 'Contains Dairy' },
];
