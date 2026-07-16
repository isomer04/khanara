using Khanara.API.DTOs;
using Khanara.API.Entities;
using Khanara.API.Helpers;

namespace Khanara.API.Interfaces;

public interface ICookRepository
{
    Task<CookProfile?> GetCookProfileByIdAsync(int id);
    Task<CookProfile?> GetCookProfileByUserIdAsync(string userId);
    Task<PaginatedResult<CookProfileDto>> GetCookProfilesAsync(CookProfileParams cookParams);
    void AddCookProfile(CookProfile profile);
    void Update(CookProfile profile);
    Task IncrementReviewStatsAsync(int cookProfileId, decimal newRating);
}
