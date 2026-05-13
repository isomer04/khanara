import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgOptimizedImage } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { DishService } from '../../../core/services/dish-service';
import { CookService } from '../../../core/services/cook-service';
import { ToastService } from '../../../core/services/toast-service';
import { CuisineTag, CuisineTagLabels } from '../../../types/cook-profile';
import { DietaryTagLabels, DietaryTags, Dish, DishPhoto } from '../../../types/dish';
import { ImageUpload } from '../../../shared/image-upload/image-upload';

@Component({
  selector: 'app-dish-form',
  imports: [FormsModule, ImageUpload, NgOptimizedImage],
  templateUrl: './dish-form.html',
})
export class DishForm implements OnInit {
  private dishService = inject(DishService);
  private cookService = inject(CookService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toast = inject(ToastService);

  protected isEditMode = signal(false);
  protected dishId = signal<number | null>(null);
  protected loading = signal(false);
  protected photoUploading = signal(false);
  protected photos = signal<DishPhoto[]>([]);

  protected cuisineTags = Object.entries(CuisineTagLabels).map(([key, label]) => ({
    value: Number(key),
    label,
  }));
  protected dietaryTagOptions = DietaryTagLabels;

  protected form = {
    name: '',
    description: '',
    price: 0,
    cuisineTag: CuisineTag.Bengali as number,
    selectedDietaryTags: 0,
    portionsPerBatch: 1,
    portionsRemainingToday: 1,
    isAvailable: true,
  };

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode.set(true);
      this.dishId.set(Number(id));
      this.loading.set(true);
      this.dishService.getDish(Number(id)).subscribe({
        next: dish => this.populateForm(dish),
        error: () => this.router.navigateByUrl('/cook/dashboard'),
        complete: () => this.loading.set(false),
      });
    }
  }

  private populateForm(dish: Dish) {
    this.form = {
      name: dish.name,
      description: dish.description || '',
      price: dish.price,
      cuisineTag: dish.cuisineTag,
      selectedDietaryTags: dish.dietaryTags,
      portionsPerBatch: dish.portionsPerBatch,
      portionsRemainingToday: dish.portionsRemainingToday,
      isAvailable: dish.isAvailable,
    };
    this.photos.set(dish.photos);
  }

  hasDietaryFlag(flag: DietaryTags) {
    return (this.form.selectedDietaryTags & flag) === flag;
  }

  toggleDietaryFlag(flag: DietaryTags) {
    this.form.selectedDietaryTags = this.form.selectedDietaryTags ^ flag;
  }

  submit() {
    this.loading.set(true);

    if (this.isEditMode()) {
      this.dishService.updateDish(this.dishId()!, {
        name: this.form.name,
        description: this.form.description || undefined,
        price: this.form.price,
        cuisineTag: this.form.cuisineTag,
        dietaryTags: this.form.selectedDietaryTags,
        portionsPerBatch: this.form.portionsPerBatch,
        portionsRemainingToday: this.form.portionsRemainingToday,
        isAvailable: this.form.isAvailable,
      }).subscribe({
        next: () => {
          this.toast.success('Dish updated');
          this.router.navigateByUrl('/cook/dashboard');
        },
        error: err => this.toast.error(err.error),
        complete: () => this.loading.set(false),
      });
    } else {
      this.dishService.createDish({
        name: this.form.name,
        description: this.form.description || undefined,
        price: this.form.price,
        cuisineTag: this.form.cuisineTag,
        dietaryTags: this.form.selectedDietaryTags,
        portionsPerBatch: this.form.portionsPerBatch,
      }).subscribe({
        next: dish => {
          this.dishId.set(dish.id);
          this.isEditMode.set(true);
          this.toast.success('Dish created! You can now add photos.');
        },
        error: err => this.toast.error(err.error),
        complete: () => this.loading.set(false),
      });
    }
  }

  onUploadPhoto(file: File) {
    const id = this.dishId();
    if (!id) {
      this.toast.error('Save the dish first before uploading photos');
      return;
    }
    this.photoUploading.set(true);
    this.dishService.uploadPhoto(id, file).subscribe({
      next: photo => this.photos.set([...this.photos(), photo]),
      error: () => this.toast.error('Failed to upload photo'),
      complete: () => this.photoUploading.set(false),
    });
  }

  deletePhoto(photoId: number) {
    const id = this.dishId();
    if (!id) return;
    this.dishService.deletePhoto(id, photoId).subscribe({
      next: () => this.photos.set(this.photos().filter(p => p.id !== photoId)),
      error: () => this.toast.error('Failed to delete photo'),
    });
  }
}
