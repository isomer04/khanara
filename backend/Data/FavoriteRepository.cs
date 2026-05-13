using Khanara.API.DTOs;
using Khanara.API.Entities;
using Khanara.API.Helpers;
using Khanara.API.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Khanara.API.Data;

public class FavoriteRepository(AppDbContext context) : IFavoriteRepository
{
    public async Task<Favorite?> GetFavoriteAsync(string eaterUserId, int cookProfileId)
    {
        return await context.Favorites
            .FirstOrDefaultAsync(f => f.EaterUserId == eaterUserId && f.CookProfileId == cookProfileId);
    }

    public async Task<PaginatedResult<FavoriteDto>> GetFavoritesAsync(string eaterUserId, PagingParams pagingParams)
    {
        var query = context.Favorites
            .Where(f => f.EaterUserId == eaterUserId)
            .OrderByDescending(f => f.CreatedAt)
            .ThenBy(f => f.CookProfileId)
            .Select(f => new FavoriteDto
            {
                CookProfileId = f.CookProfileId,
                KitchenName = f.CookProfile.KitchenName,
                KitchenPhotoUrl = f.CookProfile.KitchenPhotoUrl,
                AverageRating = f.CookProfile.AverageRating,
                ReviewCount = f.CookProfile.ReviewCount,
                IsAcceptingOrders = f.CookProfile.IsAcceptingOrders,
                FavoritedAt = f.CreatedAt,
            });

        return await PaginationHelper.CreateAsync(query, pagingParams.PageNumber, pagingParams.PageSize);
    }

    public async Task<List<int>> GetFavoriteIdsAsync(string eaterUserId)
    {
        return await context.Favorites
            .Where(f => f.EaterUserId == eaterUserId)
            .Select(f => f.CookProfileId)
            .ToListAsync();
    }

    public void AddFavorite(Favorite favorite) => context.Favorites.Add(favorite);

    public void RemoveFavorite(Favorite favorite) => context.Favorites.Remove(favorite);
}
