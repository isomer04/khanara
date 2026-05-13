using Khanara.API.DTOs;
using Khanara.API.Entities;
using Khanara.API.Helpers;
using Khanara.API.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Khanara.API.Data;

public class DishRepository(AppDbContext context) : IDishRepository
{
    public async Task<Dish?> GetDishByIdAsync(int id)
    {
        return await context.Dishes
            .Include(d => d.Photos)
            .Include(d => d.CookProfile)
            .FirstOrDefaultAsync(d => d.Id == id);
    }

    public async Task<PaginatedResult<DishDto>> GetDishesAsync(DishParams dishParams)
    {
        var query = context.Dishes
            .Include(d => d.Photos)
            .Include(d => d.CookProfile)
            .Where(d => d.IsAvailable)
            .AsQueryable();

        if (dishParams.Cuisine.HasValue)
            query = query.Where(d => d.CuisineTag == dishParams.Cuisine.Value);

        if (dishParams.Dietary.HasValue && dishParams.Dietary.Value != DietaryTags.None)
            query = query.Where(d => (d.DietaryTags & dishParams.Dietary.Value) == dishParams.Dietary.Value);

        if (!string.IsNullOrWhiteSpace(dishParams.Zip))
            query = query.Where(d => d.CookProfile.ServiceZipCodes.Contains(dishParams.Zip));

        var projected = query.Select(d => new DishDto
        {
            Id = d.Id,
            CookProfileId = d.CookProfileId,
            Name = d.Name,
            Description = d.Description,
            Price = d.Price,
            CuisineTag = d.CuisineTag,
            DietaryTags = d.DietaryTags,
            PortionsPerBatch = d.PortionsPerBatch,
            PortionsRemainingToday = d.PortionsRemainingToday,
            IsAvailable = d.IsAvailable,
            CreatedAt = d.CreatedAt,
            Photos = d.Photos.Select(p => new DishPhotoDto
            {
                Id = p.Id,
                Url = p.Url,
                IsMain = p.IsMain
            }).ToList()
        });

        return await PaginationHelper.CreateAsync(projected, dishParams.PageNumber, dishParams.PageSize);
    }

    public void AddDish(Dish dish) => context.Dishes.Add(dish);

    public void Update(Dish dish) => context.Entry(dish).State = EntityState.Modified;

    public void DeleteDish(Dish dish) => context.Dishes.Remove(dish);

    public void AddPhoto(DishPhoto photo) => context.DishPhotos.Add(photo);

    public async Task<DishPhoto?> GetPhotoByIdAsync(int photoId)
    {
        return await context.DishPhotos.FindAsync(photoId);
    }

    public void DeletePhoto(DishPhoto photo) => context.DishPhotos.Remove(photo);
}
