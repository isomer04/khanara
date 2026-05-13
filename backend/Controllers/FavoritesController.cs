using Khanara.API.DTOs;
using Khanara.API.Entities;
using Khanara.API.Extensions;
using Khanara.API.Helpers;
using Khanara.API.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Khanara.API.Controllers;

[Authorize]
public class FavoritesController(IUnitOfWork uow, ILogger<FavoritesController> logger) : BaseApiController
{
    [HttpPost("{cookId:int}")]
    public async Task<IActionResult> AddFavorite(int cookId)
    {
        var callerId = User.GetMemberId();

        var cook = await uow.CookRepository.GetCookProfileByIdAsync(cookId);
        if (cook == null) return NotFound("Cook not found");
        if (cook.AppUserId == callerId) return BadRequest("You cannot favorite your own kitchen");

        var existing = await uow.FavoriteRepository.GetFavoriteAsync(callerId, cookId);
        if (existing != null) return Ok();

        uow.FavoriteRepository.AddFavorite(new Favorite
        {
            EaterUserId = callerId,
            CookProfileId = cookId,
        });

        try
        {
            if (!await uow.Complete()) return BadRequest("Failed to save favorite");
        }
        catch (DbUpdateException ex) when (IsUniqueConstraintViolation(ex))
        {
            logger.LogInformation(
                "Concurrent favorite insert for user {UserId} / cook {CookId} — treating as success",
                callerId, cookId);
            return Ok();
        }

        return StatusCode(201);
    }

    [HttpDelete("{cookId:int}")]
    public async Task<IActionResult> RemoveFavorite(int cookId)
    {
        var callerId = User.GetMemberId();

        var favorite = await uow.FavoriteRepository.GetFavoriteAsync(callerId, cookId);
        if (favorite == null) return NotFound("Favorite not found");

        uow.FavoriteRepository.RemoveFavorite(favorite);

        if (!await uow.Complete()) return BadRequest("Failed to remove favorite");

        return NoContent();
    }

    [HttpGet]
    public async Task<ActionResult<PaginatedResult<FavoriteDto>>> GetFavorites([FromQuery] PagingParams pagingParams)
    {
        var callerId = User.GetMemberId();
        var result = await uow.FavoriteRepository.GetFavoritesAsync(callerId, pagingParams);
        return Ok(result);
    }

    [HttpGet("ids")]
    public async Task<ActionResult<List<int>>> GetFavoriteIds()
    {
        var callerId = User.GetMemberId();
        var ids = await uow.FavoriteRepository.GetFavoriteIdsAsync(callerId);
        return Ok(ids);
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private static bool IsUniqueConstraintViolation(DbUpdateException ex)
        => ex.InnerException?.Message.Contains("UNIQUE constraint failed") == true ||
           ex.InnerException?.Message.Contains("duplicate key") == true;
}
