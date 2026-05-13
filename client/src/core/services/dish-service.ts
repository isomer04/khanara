import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { Dish, DishPhoto, CreateDishDto, UpdateDishDto } from '../../types/dish';
import { PaginatedResult } from '../../types/pagination';

@Injectable({ providedIn: 'root' })
export class DishService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiUrl;

  getDishes(pageNumber = 1, pageSize = 12, cuisine?: number, dietary?: number, zip?: string) {
    let params = new HttpParams()
      .set('pageNumber', pageNumber)
      .set('pageSize', pageSize);
    if (cuisine !== undefined) params = params.set('cuisine', cuisine);
    if (dietary !== undefined) params = params.set('dietary', dietary);
    if (zip) params = params.set('zip', zip);

    return this.http.get<PaginatedResult<Dish>>(this.baseUrl + 'dishes', { params });
  }

  getDish(id: number) {
    return this.http.get<Dish>(this.baseUrl + `dishes/${id}`);
  }

  createDish(dto: CreateDishDto) {
    return this.http.post<Dish>(this.baseUrl + 'dishes', dto);
  }

  updateDish(id: number, dto: UpdateDishDto) {
    return this.http.put<Dish>(this.baseUrl + `dishes/${id}`, dto);
  }

  deleteDish(id: number) {
    return this.http.delete(this.baseUrl + `dishes/${id}`);
  }

  uploadPhoto(dishId: number, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<DishPhoto>(this.baseUrl + `dishes/${dishId}/photos`, formData);
  }

  deletePhoto(dishId: number, photoId: number) {
    return this.http.delete(this.baseUrl + `dishes/${dishId}/photos/${photoId}`);
  }
}
