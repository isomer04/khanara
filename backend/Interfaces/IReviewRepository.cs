using Khanara.API.DTOs;
using Khanara.API.Entities;
using Khanara.API.Helpers;

namespace Khanara.API.Interfaces;

public interface IReviewRepository
{
    Task<Review?> GetReviewByOrderIdAsync(int orderId);
    Task<Review?> GetReviewByIdAsync(int reviewId);
    Task<PaginatedResult<ReviewDto>> GetReviewsForCookAsync(int cookProfileId, int pageNumber, int pageSize);
    void AddReview(Review review);
}
