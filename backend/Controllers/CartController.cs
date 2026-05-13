using Khanara.API.DTOs;
using Khanara.API.Entities;
using Khanara.API.Extensions;
using Khanara.API.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Khanara.API.Controllers;

[Authorize]
public class CartController(IUnitOfWork uow) : BaseApiController
{
    private const int MaxQuantity = 100;

    [HttpGet]
    public async Task<ActionResult<List<CartItemDto>>> GetCart()
    {
        var userId = User.GetMemberId();
        var items = await uow.CartRepository.GetCartByUserIdAsync(userId);

        return Ok(items.Select(MapToDto).ToList());
    }

    [HttpPost]
    public async Task<ActionResult<CartItemDto>> AddToCart(AddCartItemDto dto)
    {
        var userId = User.GetMemberId();

        // Check if dish exists and is available
        var dish = await uow.DishRepository.GetDishByIdAsync(dto.DishId);
        if (dish == null) return NotFound("Dish not found");
        if (!dish.IsAvailable) return BadRequest("Dish is not available");

        // Retry logic for optimistic concurrency and unique constraint violations
        const int maxRetries = 3;
        for (int attempt = 0; attempt < maxRetries; attempt++)
        {
            try
            {
                // Check if item already in cart
                var existing = await uow.CartRepository.GetCartItemAsync(userId, dto.DishId);

                if (existing != null)
                {
                    // Update quantity with validation
                    var newQuantity = existing.Quantity + dto.Quantity;
                    if (newQuantity > MaxQuantity)
                        return BadRequest($"Cart quantity cannot exceed {MaxQuantity} for a single dish");

                    existing.Quantity = newQuantity;
                    uow.CartRepository.UpdateCartItem(existing);
                }
                else
                {
                    // Add new item
                    var item = new CartItem
                    {
                        UserId = userId,
                        DishId = dto.DishId,
                        Quantity = dto.Quantity
                    };
                    uow.CartRepository.AddCartItem(item);
                }

                if (!await uow.Complete()) return BadRequest("Failed to add item to cart");

                var updated = await uow.CartRepository.GetCartItemAsync(userId, dto.DishId);
                return Ok(MapToDto(updated!));
            }
            catch (DbUpdateConcurrencyException ex)
            {
                // Reload entities to get fresh data
                foreach (var entry in ex.Entries)
                {
                    await entry.ReloadAsync();
                }

                if (attempt == maxRetries - 1)
                    return Conflict("Cart was modified by another request. Please try again.");

                // Retry with fresh data
            }
            catch (DbUpdateException ex) when (IsUniqueConstraintViolation(ex))
            {
                // Race condition: another request inserted the same item
                // Reload and update instead
                var existing = await uow.CartRepository.GetCartItemAsync(userId, dto.DishId);
                if (existing != null)
                {
                    var newQuantity = existing.Quantity + dto.Quantity;
                    if (newQuantity > MaxQuantity)
                        return BadRequest($"Cart quantity cannot exceed {MaxQuantity} for a single dish");

                    existing.Quantity = newQuantity;
                    uow.CartRepository.UpdateCartItem(existing);

                    if (!await uow.Complete()) return BadRequest("Failed to add item to cart");

                    return Ok(MapToDto(existing));
                }

                // Item still doesn't exist, rethrow
                if (attempt == maxRetries - 1) throw;
            }
        }

        return BadRequest("Failed to add item to cart");
    }

    [HttpPut("{dishId:int}")]
    public async Task<ActionResult<CartItemDto>> UpdateQuantity(int dishId, UpdateCartItemDto dto)
    {
        var userId = User.GetMemberId();

        // Retry logic for optimistic concurrency
        const int maxRetries = 3;
        for (int attempt = 0; attempt < maxRetries; attempt++)
        {
            try
            {
                var item = await uow.CartRepository.GetCartItemAsync(userId, dishId);
                if (item == null) return NotFound();

                item.Quantity = dto.Quantity;
                uow.CartRepository.UpdateCartItem(item);

                if (!await uow.Complete()) return BadRequest("Failed to update cart");

                return Ok(MapToDto(item));
            }
            catch (DbUpdateConcurrencyException ex)
            {
                // Reload entities to get fresh data
                foreach (var entry in ex.Entries)
                {
                    await entry.ReloadAsync();
                }

                if (attempt == maxRetries - 1)
                    return Conflict("Cart was modified by another request. Please try again.");

                // Retry with fresh data
            }
        }

        return BadRequest("Failed to update cart");
    }

    [HttpDelete("{dishId:int}")]
    public async Task<ActionResult> RemoveFromCart(int dishId)
    {
        var userId = User.GetMemberId();
        var item = await uow.CartRepository.GetCartItemAsync(userId, dishId);

        if (item == null) return NotFound();

        uow.CartRepository.RemoveCartItem(item);

        if (!await uow.Complete()) return BadRequest("Failed to remove item");

        return NoContent();
    }

    [HttpDelete]
    public async Task<ActionResult> ClearCart()
    {
        var userId = User.GetMemberId();
        await uow.CartRepository.ClearCartAsync(userId);

        if (uow.HasChanges() && !await uow.Complete())
            return BadRequest("Failed to clear cart");

        return NoContent();
    }

    [HttpPost("merge")]
    public async Task<ActionResult<List<CartItemDto>>> MergeCart(MergeCartDto dto)
    {
        var userId = User.GetMemberId();

        // Aggregate items by DishId to prevent duplicate inserts
        var aggregatedItems = dto.Items
            .GroupBy(i => i.DishId)
            .Select(g => new { DishId = g.Key, Quantity = g.Sum(i => i.Quantity) })
            .ToList();

        // Retry logic for optimistic concurrency and unique constraint violations
        const int maxRetries = 3;
        for (int attempt = 0; attempt < maxRetries; attempt++)
        {
            try
            {
                foreach (var item in aggregatedItems)
                {
                    // Verify dish exists and is available
                    var dish = await uow.DishRepository.GetDishByIdAsync(item.DishId);
                    if (dish == null || !dish.IsAvailable) continue;

                    var existing = await uow.CartRepository.GetCartItemAsync(userId, item.DishId);

                    if (existing != null)
                    {
                        // Update quantity with validation
                        var newQuantity = existing.Quantity + item.Quantity;
                        if (newQuantity > MaxQuantity)
                            continue; // Skip items that would exceed limit

                        existing.Quantity = newQuantity;
                        uow.CartRepository.UpdateCartItem(existing);
                    }
                    else
                    {
                        var cartItem = new CartItem
                        {
                            UserId = userId,
                            DishId = item.DishId,
                            Quantity = item.Quantity
                        };
                        uow.CartRepository.AddCartItem(cartItem);
                    }
                }

                if (uow.HasChanges() && !await uow.Complete())
                    return BadRequest("Failed to merge cart");

                var cart = await uow.CartRepository.GetCartByUserIdAsync(userId);
                return Ok(cart.Select(MapToDto).ToList());
            }
            catch (DbUpdateConcurrencyException ex)
            {
                // Reload entities to get fresh data
                foreach (var entry in ex.Entries)
                {
                    await entry.ReloadAsync();
                }

                if (attempt == maxRetries - 1)
                    return Conflict("Cart was modified by another request. Please try again.");

                // Retry with fresh data
            }
            catch (DbUpdateException ex) when (IsUniqueConstraintViolation(ex))
            {
                // Race condition: another request inserted the same item
                // Continue to next retry - will be handled as update
                if (attempt == maxRetries - 1)
                    return BadRequest("Failed to merge cart due to concurrent modifications");
            }
        }

        return BadRequest("Failed to merge cart");
    }

    private static bool IsUniqueConstraintViolation(DbUpdateException ex)
    {
        // SQLite unique constraint violation
        return ex.InnerException?.Message.Contains("UNIQUE constraint failed") == true ||
               ex.InnerException?.Message.Contains("duplicate key") == true;
    }

    private static CartItemDto MapToDto(CartItem item) => new()
    {
        Id = item.Id,
        DishId = item.DishId,
        DishName = item.Dish?.Name ?? string.Empty,
        Price = item.Dish?.Price ?? 0,
        Quantity = item.Quantity,
        PhotoUrl = item.Dish?.Photos?.FirstOrDefault()?.Url,
        CookProfileId = item.Dish?.CookProfileId ?? 0,
        AddedAt = item.AddedAt
    };
}
