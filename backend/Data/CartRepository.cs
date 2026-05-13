using Khanara.API.Entities;
using Khanara.API.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Khanara.API.Data;

public class CartRepository(AppDbContext context) : ICartRepository
{
    public async Task<List<CartItem>> GetCartByUserIdAsync(string userId)
    {
        return await context.CartItems
            .Include(c => c.Dish)
                .ThenInclude(d => d.Photos)
            .Where(c => c.UserId == userId)
            .OrderBy(c => c.AddedAt)
            .ToListAsync();
    }

    public async Task<CartItem?> GetCartItemAsync(string userId, int dishId)
    {
        return await context.CartItems
            .Include(c => c.Dish)
                .ThenInclude(d => d.Photos)
            .FirstOrDefaultAsync(c => c.UserId == userId && c.DishId == dishId);
    }

    public void AddCartItem(CartItem item)
    {
        context.CartItems.Add(item);
    }

    public void UpdateCartItem(CartItem item)
    {
        item.UpdatedAt = DateTime.UtcNow;
        context.CartItems.Update(item);
    }

    public void RemoveCartItem(CartItem item)
    {
        context.CartItems.Remove(item);
    }

    public async Task ClearCartAsync(string userId)
    {
        var items = await context.CartItems
            .Where(c => c.UserId == userId)
            .ToListAsync();
        context.CartItems.RemoveRange(items);
    }
}
