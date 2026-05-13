using Khanara.API.DTOs;
using Khanara.API.Entities;
using Khanara.API.Helpers;

namespace Khanara.API.Interfaces;

public interface IFavoriteRepository
{
    Task<Favorite?> GetFavoriteAsync(string eaterUserId, int cookProfileId);
    Task<PaginatedResult<FavoriteDto>> GetFavoritesAsync(string eaterUserId, PagingParams pagingParams);
    void AddFavorite(Favorite favorite);
    void RemoveFavorite(Favorite favorite);
    Task<List<int>> GetFavoriteIdsAsync(string eaterUserId);
}
