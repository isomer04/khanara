using Khanara.API.Entities;

namespace Khanara.API.Interfaces;

public interface ICartRepository
{
    Task<List<CartItem>> GetCartByUserIdAsync(string userId);
    Task<CartItem?> GetCartItemAsync(string userId, int dishId);
    void AddCartItem(CartItem item);
    void UpdateCartItem(CartItem item);
    void RemoveCartItem(CartItem item);
    Task ClearCartAsync(string userId);
}
