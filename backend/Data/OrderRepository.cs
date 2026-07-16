using Khanara.API.DTOs;
using Khanara.API.Entities;
using Khanara.API.Helpers;
using Khanara.API.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Khanara.API.Data;

public class OrderRepository(AppDbContext context) : IOrderRepository
{
    public async Task<Order?> GetOrderByIdAsync(int id)
    {
        return await context.Orders
            .Include(o => o.EaterUser)
            .Include(o => o.CookProfile)
            .Include(o => o.Items).ThenInclude(i => i.Dish)
            .FirstOrDefaultAsync(o => o.Id == id);
    }

    public async Task<PaginatedResult<OrderDto>> GetOrdersByEaterAsync(string eaterId, OrderParams orderParams)
    {
        var query = context.Orders
            .Where(o => o.EaterUserId == eaterId)
            .AsQueryable();

        if (orderParams.Status.HasValue)
            query = query.Where(o => o.Status == orderParams.Status.Value);

        var projected = query
            .OrderByDescending(o => o.CreatedAt)
            .Select(o => new OrderDto
            {
                Id = o.Id,
                EaterUserId = o.EaterUserId,
                EaterDisplayName = o.EaterUser.DisplayName,
                CookProfileId = o.CookProfileId,
                CookKitchenName = o.CookProfile.KitchenName,
                Status = o.Status,
                PaymentMethod = o.PaymentMethod,
                PaymentStatus = o.PaymentStatus,
                FulfillmentType = o.FulfillmentType,
                TotalAmount = o.TotalAmount,
                ScheduledFor = o.ScheduledFor,
                Notes = o.Notes,
                CancellationReason = o.CancellationReason,
                CreatedAt = o.CreatedAt,
                UpdatedAt = o.UpdatedAt,
                Items = o.Items.Select(i => new OrderItemDto
                {
                    Id = i.Id,
                    DishId = i.DishId,
                    DishName = i.Dish.Name,
                    Quantity = i.Quantity,
                    UnitPriceSnapshot = i.UnitPriceSnapshot
                }).ToList()
            });

        return await PaginationHelper.CreateAsync(projected, orderParams.PageNumber, orderParams.PageSize);
    }

    public async Task<PaginatedResult<OrderDto>> GetOrdersByCookAsync(int cookProfileId, OrderParams orderParams)
    {
        var query = context.Orders
            .Where(o => o.CookProfileId == cookProfileId)
            .AsQueryable();

        if (orderParams.Status.HasValue)
            query = query.Where(o => o.Status == orderParams.Status.Value);

        var projected = query
            .OrderByDescending(o => o.CreatedAt)
            .Select(o => new OrderDto
            {
                Id = o.Id,
                EaterUserId = o.EaterUserId,
                EaterDisplayName = o.EaterUser.DisplayName,
                CookProfileId = o.CookProfileId,
                CookKitchenName = o.CookProfile.KitchenName,
                Status = o.Status,
                PaymentMethod = o.PaymentMethod,
                PaymentStatus = o.PaymentStatus,
                FulfillmentType = o.FulfillmentType,
                TotalAmount = o.TotalAmount,
                ScheduledFor = o.ScheduledFor,
                Notes = o.Notes,
                CancellationReason = o.CancellationReason,
                CreatedAt = o.CreatedAt,
                UpdatedAt = o.UpdatedAt,
                Items = o.Items.Select(i => new OrderItemDto
                {
                    Id = i.Id,
                    DishId = i.DishId,
                    DishName = i.Dish.Name,
                    Quantity = i.Quantity,
                    UnitPriceSnapshot = i.UnitPriceSnapshot
                }).ToList()
            });

        return await PaginationHelper.CreateAsync(projected, orderParams.PageNumber, orderParams.PageSize);
    }

    public void AddOrder(Order order) => context.Orders.Add(order);
}
