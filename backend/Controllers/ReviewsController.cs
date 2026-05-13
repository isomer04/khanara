using Khanara.API.DTOs;
using Khanara.API.Entities;
using Khanara.API.Extensions;
using Khanara.API.Helpers;
using Khanara.API.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Khanara.API.Controllers;

[Authorize]
public class ReviewsController(IUnitOfWork uow) : BaseApiController
{
    [Authorize]
    [HttpPost]
    public async Task<ActionResult<ReviewDto>> CreateReview(CreateReviewDto dto)
    {
        var callerId = User.GetMemberId();

        var order = await uow.OrderRepository.GetOrderByIdAsync(dto.OrderId);
        if (order == null) return NotFound("Order not found");
        if (order.EaterUserId != callerId) return Forbid();
        if (order.Status != OrderStatus.Delivered)
            return BadRequest("You can only review a delivered order");

        var existing = await uow.ReviewRepository.GetReviewByOrderIdAsync(dto.OrderId);
        if (existing != null) return BadRequest("You have already reviewed this order");

        var review = new Review
        {
            OrderId = dto.OrderId,
            Rating = dto.Rating,
            Comment = dto.Comment?.Trim(),
            AuthorUserId = callerId,
        };

        uow.ReviewRepository.AddReview(review);
        if (!await uow.Complete()) return BadRequest("Failed to submit review");

        // Atomic DB-level update — avoids read-modify-write race when concurrent reviews arrive
        await uow.CookRepository.IncrementReviewStatsAsync(order.CookProfileId, dto.Rating);

        var created = await uow.ReviewRepository.GetReviewByIdAsync(review.Id);
        return CreatedAtAction(nameof(GetReviewByOrder), new { orderId = dto.OrderId }, MapToDto(created!));
    }

    [Authorize]
    [HttpGet("order/{orderId:int}")]
    public async Task<ActionResult<ReviewDto>> GetReviewByOrder(int orderId)
    {
        var callerId = User.GetMemberId();

        var order = await uow.OrderRepository.GetOrderByIdAsync(orderId);
        if (order == null) return NotFound("Order not found");
        if (order.EaterUserId != callerId && order.CookProfile?.AppUserId != callerId)
            return Forbid();

        var review = await uow.ReviewRepository.GetReviewByOrderIdAsync(orderId);
        if (review == null) return NotFound();

        return Ok(MapToDto(review));
    }

    [Authorize(Policy = "RequireCookRole")]
    [HttpPost("{reviewId:int}/reply")]
    public async Task<ActionResult<ReviewDto>> AddReply(int reviewId, AddReplyDto dto)
    {
        var callerId = User.GetMemberId();

        var review = await uow.ReviewRepository.GetReviewByIdAsync(reviewId);
        if (review == null) return NotFound("Review not found");
        if (review.Order.CookProfile?.AppUserId != callerId) return Forbid();
        if (review.CookReply != null) return BadRequest("You have already replied to this review");

        review.CookReply = dto.Reply.Trim();
        review.CookRepliedAt = DateTime.UtcNow;

        if (!await uow.Complete()) return BadRequest("Failed to save reply");

        return Ok(MapToDto(review));
    }

    private static ReviewDto MapToDto(Review r) => new()
    {
        Id = r.Id,
        OrderId = r.OrderId,
        Rating = r.Rating,
        Comment = r.Comment,
        AuthorDisplayName = r.Author?.DisplayName ?? string.Empty,
        AuthorPhotoUrl = r.Author?.ImageUrl,
        CookReply = r.CookReply,
        CookRepliedAt = r.CookRepliedAt,
        CreatedAt = r.CreatedAt,
    };
}
