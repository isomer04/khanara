using Khanara.API.DTOs;
using Khanara.API.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Khanara.API.Data;

public class DiscoveryRepository(AppDbContext context) : IDiscoveryRepository
{
    private static DiscoveryCookDto MapToDto(Khanara.API.Entities.CookProfile c) => new()
    {
        Id = c.Id,
        KitchenName = c.KitchenName,
        KitchenPhotoUrl = c.KitchenPhotoUrl,
        AverageRating = c.AverageRating,
        ReviewCount = c.ReviewCount,
        IsAcceptingOrders = c.IsAcceptingOrders,
        CuisineTags = c.CuisineTags,
        ServiceZipCodes = c.ServiceZipCodes,
        CreatedAt = c.CreatedAt,
    };

    public async Task<List<DiscoveryCookDto>> GetNearMeAsync(string zip)
    {
        return await context.CookProfiles
            .Where(c => c.ServiceZipCodes.Contains(zip))
            .OrderByDescending(c => c.AverageRating)
            .Take(50)
            .Select(c => new DiscoveryCookDto
            {
                Id = c.Id,
                KitchenName = c.KitchenName,
                KitchenPhotoUrl = c.KitchenPhotoUrl,
                AverageRating = c.AverageRating,
                ReviewCount = c.ReviewCount,
                IsAcceptingOrders = c.IsAcceptingOrders,
                CuisineTags = c.CuisineTags,
                ServiceZipCodes = c.ServiceZipCodes,
                CreatedAt = c.CreatedAt,
            })
            .ToListAsync();
    }

    public async Task<List<DiscoveryCookDto>> GetPopularAsync()
    {
        return await context.CookProfiles
            .Where(c => c.ReviewCount > 0)
            .OrderByDescending(c => c.ReviewCount * c.AverageRating)
            .ThenByDescending(c => c.ReviewCount)
            .Take(20)
            .Select(c => new DiscoveryCookDto
            {
                Id = c.Id,
                KitchenName = c.KitchenName,
                KitchenPhotoUrl = c.KitchenPhotoUrl,
                AverageRating = c.AverageRating,
                ReviewCount = c.ReviewCount,
                IsAcceptingOrders = c.IsAcceptingOrders,
                CuisineTags = c.CuisineTags,
                ServiceZipCodes = c.ServiceZipCodes,
                CreatedAt = c.CreatedAt,
            })
            .ToListAsync();
    }

    public async Task<List<DiscoveryCookDto>> GetNewAsync()
    {
        return await context.CookProfiles
            .OrderByDescending(c => c.CreatedAt)
            .Take(10)
            .Select(c => new DiscoveryCookDto
            {
                Id = c.Id,
                KitchenName = c.KitchenName,
                KitchenPhotoUrl = c.KitchenPhotoUrl,
                AverageRating = c.AverageRating,
                ReviewCount = c.ReviewCount,
                IsAcceptingOrders = c.IsAcceptingOrders,
                CuisineTags = c.CuisineTags,
                ServiceZipCodes = c.ServiceZipCodes,
                CreatedAt = c.CreatedAt,
            })
            .ToListAsync();
    }
}
