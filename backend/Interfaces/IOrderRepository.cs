using Khanara.API.DTOs;
using Khanara.API.Entities;
using Khanara.API.Helpers;

namespace Khanara.API.Interfaces;

public interface IOrderRepository
{
    Task<Order?> GetOrderByIdAsync(int id);
    Task<PaginatedResult<OrderDto>> GetOrdersByEaterAsync(string eaterId, OrderParams orderParams);
    Task<PaginatedResult<OrderDto>> GetOrdersByCookAsync(int cookProfileId, OrderParams orderParams);
    void AddOrder(Order order);
}
