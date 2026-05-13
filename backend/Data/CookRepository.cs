using Khanara.API.DTOs;
using Khanara.API.Entities;
using Khanara.API.Helpers;
using Khanara.API.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Khanara.API.Data;

public class CookRepository(AppDbContext context) : ICookRepository
{
    public async Task<CookProfile?> GetCookProfileByIdAsync(int id)
    {
        return await context.CookProfiles
            .Include(c => c.AppUser)
            .Include(c => c.Dishes).ThenInclude(d => d.Photos)
            .FirstOrDefaultAsync(c => c.Id == id);
    }

    public async Task<CookProfile?> GetCookProfileByUserIdAsync(string userId)
    {
        return await context.CookProfiles
            .Include(c => c.AppUser)
            .Include(c => c.Dishes).ThenInclude(d => d.Photos)
            .FirstOrDefaultAsync(c => c.AppUserId == userId);
    }

    public async Task<PaginatedResult<CookProfileDto>> GetCookProfilesAsync(CookProfileParams cookParams)
    {
        var query = context.CookProfiles
            .Include(c => c.AppUser)
            .Include(c => c.Dishes).ThenInclude(d => d.Photos)
            .AsQueryable();

        if (cookParams.Cuisine.HasValue)
            query = query.Where(c => c.CuisineTags.Contains(cookParams.Cuisine.Value));

        if (!string.IsNullOrWhiteSpace(cookParams.Zip))
            query = query.Where(c => c.ServiceZipCodes.Contains(cookParams.Zip));

        var projected = query.Select(c => new CookProfileDto
        {
            Id = c.Id,
            AppUserId = c.AppUserId,
            KitchenName = c.KitchenName,
            Bio = c.Bio,
            CuisineTags = c.CuisineTags,
            ServiceZipCodes = c.ServiceZipCodes,
            KitchenPhotoUrl = c.KitchenPhotoUrl,
            IsAcceptingOrders = c.IsAcceptingOrders,
            AverageRating = c.AverageRating,
            ReviewCount = c.ReviewCount,
            CreatedAt = c.CreatedAt,
            OwnerDisplayName = c.AppUser.DisplayName,
            Dishes = c.Dishes.Select(d => new DishDto
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
            }).ToList()
        });

        return await PaginationHelper.CreateAsync(projected, cookParams.PageNumber, cookParams.PageSize);
    }

    public void AddCookProfile(CookProfile profile) => context.CookProfiles.Add(profile);

    public void Update(CookProfile profile) => context.Entry(profile).State = EntityState.Modified;

    public async Task IncrementReviewStatsAsync(int cookProfileId, decimal newRating)
    {
        await context.CookProfiles
            .Where(c => c.Id == cookProfileId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(c => c.ReviewCount, c => c.ReviewCount + 1)
                .SetProperty(c => c.AverageRating,
                    c => (c.AverageRating * c.ReviewCount + newRating) / (c.ReviewCount + 1)));
    }
}
