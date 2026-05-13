using Khanara.API.DTOs;
using Khanara.API.Entities;
using Khanara.API.Extensions;
using Khanara.API.Helpers;
using Khanara.API.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace Khanara.API.Controllers;

public class CooksController(IUnitOfWork uow, UserManager<AppUser> userManager) : BaseApiController
{
    [HttpGet]
    public async Task<ActionResult<PaginatedResult<CookProfileDto>>> GetCooks(
        [FromQuery] CookProfileParams cookParams)
    {
        return Ok(await uow.CookRepository.GetCookProfilesAsync(cookParams));
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<CookProfileDto>> GetCook(int id)
    {
        var profile = await uow.CookRepository.GetCookProfileByIdAsync(id);
        if (profile == null) return NotFound();

        return Ok(MapToDto(profile));
    }

    [Authorize(Policy = "RequireCookRole")]
    [HttpGet("me")]
    public async Task<ActionResult<CookProfileDto>> GetMyCookProfile()
    {
        var userId = User.GetMemberId();
        var profile = await uow.CookRepository.GetCookProfileByUserIdAsync(userId);
        if (profile == null) return NotFound();
        return Ok(MapToDto(profile));
    }

    [Authorize]
    [HttpPost]
    public async Task<ActionResult<CookProfileDto>> CreateCookProfile(CreateCookProfileDto dto)
    {
        var userId = User.GetMemberId();

        var existing = await uow.CookRepository.GetCookProfileByUserIdAsync(userId);
        if (existing != null) return BadRequest("You already have a cook profile");

        var user = await userManager.FindByIdAsync(userId);
        if (user == null) return BadRequest("User not found");

        var profile = new CookProfile
        {
            AppUserId = userId,
            KitchenName = dto.KitchenName,
            Bio = dto.Bio,
            CuisineTags = dto.CuisineTags,
            ServiceZipCodes = dto.ServiceZipCodes
        };

        var roleResult = await userManager.AddToRoleAsync(user, "Cook");
        if (!roleResult.Succeeded)
            return BadRequest("Failed to assign Cook role");

        uow.CookRepository.AddCookProfile(profile);
        if (!await uow.Complete())
        {
            await userManager.RemoveFromRoleAsync(user, "Cook");
            return BadRequest("Failed to create cook profile");
        }

        var created = await uow.CookRepository.GetCookProfileByIdAsync(profile.Id);
        return CreatedAtAction(nameof(GetCook), new { id = profile.Id }, MapToDto(created!));
    }

    [HttpGet("{id:int}/reviews")]
    public async Task<ActionResult<PaginatedResult<ReviewDto>>> GetCookReviews(
        int id, [FromQuery] int pageNumber = 1, [FromQuery] int pageSize = 5)
    {
        if (pageNumber < 1) return BadRequest("pageNumber must be >= 1");
        if (pageSize < 1) return BadRequest("pageSize must be >= 1");
        if (pageSize > 20) pageSize = 20;

        var cook = await uow.CookRepository.GetCookProfileByIdAsync(id);
        if (cook == null) return NotFound();

        return Ok(await uow.ReviewRepository.GetReviewsForCookAsync(id, pageNumber, pageSize));
    }

    [Authorize(Policy = "RequireCookRole")]
    [HttpPut("me")]
    public async Task<ActionResult<CookProfileDto>> UpdateCookProfile(UpdateCookProfileDto dto)
    {
        var userId = User.GetMemberId();
        var profile = await uow.CookRepository.GetCookProfileByUserIdAsync(userId);
        if (profile == null) return NotFound();

        if (dto.KitchenName != null) profile.KitchenName = dto.KitchenName;
        if (dto.Bio != null) profile.Bio = dto.Bio;
        if (dto.CuisineTags != null) profile.CuisineTags = dto.CuisineTags;
        if (dto.ServiceZipCodes != null) profile.ServiceZipCodes = dto.ServiceZipCodes;
        if (dto.IsAcceptingOrders.HasValue) profile.IsAcceptingOrders = dto.IsAcceptingOrders.Value;

        uow.CookRepository.Update(profile);
        if (!await uow.Complete()) return BadRequest("Failed to update cook profile");

        return Ok(MapToDto(profile));
    }

    private static CookProfileDto MapToDto(CookProfile c) => new()
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
        OwnerDisplayName = c.AppUser?.DisplayName ?? string.Empty,
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
    };
}
