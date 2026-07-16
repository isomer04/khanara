using Khanara.API.DTOs;
using Khanara.API.Entities;
using Khanara.API.Helpers;

namespace Khanara.API.Interfaces;

public interface IDishRepository
{
    Task<Dish?> GetDishByIdAsync(int id);
    Task<PaginatedResult<DishDto>> GetDishesAsync(DishParams dishParams);
    void AddDish(Dish dish);
    void Update(Dish dish);
    void DeleteDish(Dish dish);
    void AddPhoto(DishPhoto photo);
    Task<DishPhoto?> GetPhotoByIdAsync(int photoId);
    void DeletePhoto(DishPhoto photo);
}
