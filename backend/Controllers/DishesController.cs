using Khanara.API.DTOs;
using Khanara.API.Entities;
using Khanara.API.Extensions;
using Khanara.API.Helpers;
using Khanara.API.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Khanara.API.Controllers;

public class DishesController(IUnitOfWork uow, IPhotoService photoService) : BaseApiController
{
    [HttpGet]
    public async Task<ActionResult<PaginatedResult<DishDto>>> GetDishes([FromQuery] DishParams dishParams)
    {
        return Ok(await uow.DishRepository.GetDishesAsync(dishParams));
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<DishDto>> GetDish(int id)
    {
        var dish = await uow.DishRepository.GetDishByIdAsync(id);
        if (dish == null) return NotFound();
        return Ok(MapToDto(dish));
    }

    [Authorize(Policy = "RequireCookRole")]
    [HttpPost]
    public async Task<ActionResult<DishDto>> CreateDish(CreateDishDto dto)
    {
        var userId = User.GetMemberId();
        var cookProfile = await uow.CookRepository.GetCookProfileByUserIdAsync(userId);
        if (cookProfile == null) return BadRequest("Cook profile not found");

        var dish = new Dish
        {
            CookProfileId = cookProfile.Id,
            Name = dto.Name,
            Description = dto.Description,
            Price = dto.Price,
            CuisineTag = dto.CuisineTag,
            DietaryTags = dto.DietaryTags,
            PortionsPerBatch = dto.PortionsPerBatch,
            PortionsRemainingToday = dto.PortionsPerBatch
        };

        uow.DishRepository.AddDish(dish);
        if (!await uow.Complete()) return BadRequest("Failed to create dish");

        var created = await uow.DishRepository.GetDishByIdAsync(dish.Id);
        return CreatedAtAction(nameof(GetDish), new { id = dish.Id }, MapToDto(created!));
    }

    [Authorize(Policy = "RequireCookRole")]
    [HttpPut("{id:int}")]
    public async Task<ActionResult<DishDto>> UpdateDish(int id, UpdateDishDto dto)
    {
        var userId = User.GetMemberId();
        var dish = await uow.DishRepository.GetDishByIdAsync(id);
        if (dish == null) return NotFound();

        var cookProfile = await uow.CookRepository.GetCookProfileByUserIdAsync(userId);
        if (cookProfile == null || dish.CookProfileId != cookProfile.Id) return Forbid();

        if (dto.Name != null) dish.Name = dto.Name;
        if (dto.Description != null) dish.Description = dto.Description;
        if (dto.Price.HasValue) dish.Price = dto.Price.Value;
        if (dto.CuisineTag.HasValue) dish.CuisineTag = dto.CuisineTag.Value;
        if (dto.DietaryTags.HasValue) dish.DietaryTags = dto.DietaryTags.Value;
        if (dto.IsAvailable.HasValue) dish.IsAvailable = dto.IsAvailable.Value;
        if (dto.PortionsPerBatch.HasValue)
        {
            dish.PortionsPerBatch = dto.PortionsPerBatch.Value;
        }
        if (dto.PortionsRemainingToday.HasValue)
        {
            if (dto.PortionsRemainingToday.Value > dish.PortionsPerBatch)
                return BadRequest("PortionsRemainingToday cannot exceed PortionsPerBatch");
            dish.PortionsRemainingToday = dto.PortionsRemainingToday.Value;
        }

        uow.DishRepository.Update(dish);
        if (!await uow.Complete()) return BadRequest("Failed to update dish");

        return Ok(MapToDto(dish));
    }

    [Authorize(Policy = "RequireCookRole")]
    [HttpDelete("{id:int}")]
    public async Task<ActionResult> DeleteDish(int id)
    {
        var userId = User.GetMemberId();
        var dish = await uow.DishRepository.GetDishByIdAsync(id);
        if (dish == null) return NotFound();

        var cookProfile = await uow.CookRepository.GetCookProfileByUserIdAsync(userId);
        if (cookProfile == null || dish.CookProfileId != cookProfile.Id) return Forbid();

        foreach (var photo in dish.Photos.Where(p => p.PublicId != null))
            await photoService.DeletePhotoAsync(photo.PublicId!);

        uow.DishRepository.DeleteDish(dish);
        if (!await uow.Complete()) return BadRequest("Failed to delete dish");

        return NoContent();
    }

    [Authorize(Policy = "RequireCookRole")]
    [HttpPost("{id:int}/photos")]
    public async Task<ActionResult<DishPhotoDto>> AddPhoto(int id, IFormFile file)
    {
        var userId = User.GetMemberId();
        var dish = await uow.DishRepository.GetDishByIdAsync(id);
        if (dish == null) return NotFound();

        var cookProfile = await uow.CookRepository.GetCookProfileByUserIdAsync(userId);
        if (cookProfile == null || dish.CookProfileId != cookProfile.Id) return Forbid();

        var result = await photoService.UploadPhotoAsync(file);
        if (result.Error != null) return BadRequest(result.Error.Message);

        var photo = new DishPhoto
        {
            Url = result.SecureUrl.AbsoluteUri,
            PublicId = result.PublicId,
            IsMain = !dish.Photos.Any(),
            DishId = dish.Id
        };

        uow.DishRepository.AddPhoto(photo);
        if (!await uow.Complete()) return BadRequest("Failed to add photo");

        return CreatedAtAction(nameof(GetDish), new { id = dish.Id },
            new DishPhotoDto { Id = photo.Id, Url = photo.Url, IsMain = photo.IsMain });
    }

    [Authorize(Policy = "RequireCookRole")]
    [HttpDelete("{id:int}/photos/{photoId:int}")]
    public async Task<ActionResult> DeletePhoto(int id, int photoId)
    {
        var userId = User.GetMemberId();
        var dish = await uow.DishRepository.GetDishByIdAsync(id);
        if (dish == null) return NotFound();

        var cookProfile = await uow.CookRepository.GetCookProfileByUserIdAsync(userId);
        if (cookProfile == null || dish.CookProfileId != cookProfile.Id) return Forbid();

        var photo = await uow.DishRepository.GetPhotoByIdAsync(photoId);
        if (photo == null || photo.DishId != id) return NotFound();

        if (photo.PublicId != null)
        {
            var deletionResult = await photoService.DeletePhotoAsync(photo.PublicId);
            if (deletionResult.Error != null) return BadRequest(deletionResult.Error.Message);
        }

        uow.DishRepository.DeletePhoto(photo);
        if (!await uow.Complete()) return BadRequest("Failed to delete photo");

        return NoContent();
    }

    private static DishDto MapToDto(Dish d) => new()
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
    };
}
