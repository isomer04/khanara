using Khanara.API.DTOs;
using Khanara.API.Entities;
using Khanara.API.Helpers;
using Khanara.API.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Khanara.API.Data;

public class ReviewRepository(AppDbContext context) : IReviewRepository
{
    public async Task<Review?> GetReviewByOrderIdAsync(int orderId)
    {
        return await context.Reviews
            .Include(r => r.Author)
            .FirstOrDefaultAsync(r => r.OrderId == orderId);
    }

    public async Task<Review?> GetReviewByIdAsync(int reviewId)
    {
        return await context.Reviews
            .Include(r => r.Author)
            .Include(r => r.Order).ThenInclude(o => o.CookProfile)
            .FirstOrDefaultAsync(r => r.Id == reviewId);
    }

    public async Task<PaginatedResult<ReviewDto>> GetReviewsForCookAsync(int cookProfileId, int pageNumber, int pageSize)
    {
        var query = context.Reviews
            .Include(r => r.Author)
            .Where(r => r.Order.CookProfileId == cookProfileId)
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => new ReviewDto
            {
                Id = r.Id,
                OrderId = r.OrderId,
                Rating = r.Rating,
                Comment = r.Comment,
                AuthorDisplayName = r.Author.DisplayName,
                AuthorPhotoUrl = r.Author.ImageUrl,
                CookReply = r.CookReply,
                CookRepliedAt = r.CookRepliedAt,
                CreatedAt = r.CreatedAt,
            });

        return await PaginationHelper.CreateAsync(query, pageNumber, pageSize);
    }

    public void AddReview(Review review) => context.Reviews.Add(review);
}
