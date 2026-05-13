using Khanara.API.DTOs;
using Khanara.API.Entities;
using Khanara.API.Extensions;
using Khanara.API.Helpers;
using Khanara.API.Interfaces;
using Khanara.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StripeException = Stripe.StripeException;

namespace Khanara.API.Controllers;

[Authorize]
public class OrdersController(
    IUnitOfWork uow,
    OrderNotificationService notificationService,
    IStripeService stripeService,
    ILogger<OrdersController> logger) : BaseApiController
{
    // Valid forward transitions the cook can make
    private static readonly Dictionary<OrderStatus, OrderStatus[]> CookTransitions = new()
    {
        [OrderStatus.Pending] = [OrderStatus.Accepted],
        [OrderStatus.Accepted] = [OrderStatus.Preparing],
        [OrderStatus.Preparing] = [OrderStatus.Ready],
        [OrderStatus.Ready] = [OrderStatus.Delivered],
    };

    // Statuses from which the cook may cancel
    private static readonly OrderStatus[] CookCancellableStatuses =
        [OrderStatus.Pending, OrderStatus.Accepted, OrderStatus.Preparing];

    [HttpPost]
    public async Task<ActionResult<OrderDto>> PlaceOrder(CreateOrderDto dto)
    {
        if (dto.Items == null || dto.Items.Count == 0)
            return BadRequest("Order must contain at least one item");

        if (dto.Items.Any(i => i.Quantity < 1))
            return BadRequest("All item quantities must be at least 1");

        if (!Enum.IsDefined(typeof(PaymentMethod), dto.PaymentMethod))
            return BadRequest("Invalid payment method");

        if (!Enum.IsDefined(typeof(FulfillmentType), dto.FulfillmentType))
            return BadRequest("Invalid fulfillment type");

        var cookProfile = await uow.CookRepository.GetCookProfileByIdAsync(dto.CookProfileId);
        if (cookProfile == null) return NotFound("Cook profile not found");
        if (!cookProfile.IsAcceptingOrders) return BadRequest("This cook is not accepting orders right now");

        var dishIds = dto.Items.Select(i => i.DishId).Distinct().ToList();

        // Validate all dishes belong to this cook and are available
        var dishes = new List<Dish>();
        foreach (var dishId in dishIds)
        {
            var dish = await uow.DishRepository.GetDishByIdAsync(dishId);
            if (dish == null) return BadRequest($"Dish {dishId} not found");
            if (dish.CookProfileId != dto.CookProfileId)
                return BadRequest($"Dish {dishId} does not belong to the specified cook");
            if (!dish.IsAvailable) return BadRequest($"Dish '{dish.Name}' is not available");
            dishes.Add(dish);
        }

        var eaterId = User.GetMemberId();

        var order = new Order
        {
            EaterUserId = eaterId,
            CookProfileId = dto.CookProfileId,
            FulfillmentType = dto.FulfillmentType,
            PaymentMethod = dto.PaymentMethod,
            ScheduledFor = dto.ScheduledFor,
            Notes = dto.Notes
        };

        foreach (var itemDto in dto.Items)
        {
            var dish = dishes.First(d => d.Id == itemDto.DishId);

            if (dish.PortionsRemainingToday < itemDto.Quantity)
                return BadRequest($"Not enough portions available for '{dish.Name}'. Only {dish.PortionsRemainingToday} left.");

            dish.PortionsRemainingToday -= itemDto.Quantity;

            order.Items.Add(new OrderItem
            {
                DishId = dish.Id,
                Quantity = itemDto.Quantity,
                UnitPriceSnapshot = dish.Price
            });
        }

        order.TotalAmount = order.Items.Sum(i => i.Quantity * i.UnitPriceSnapshot);

        uow.OrderRepository.AddOrder(order);

        try
        {
            if (!await uow.Complete()) return BadRequest("Failed to place order");
        }
        catch (DbUpdateConcurrencyException)
        {
            return Conflict("One or more dishes had their portions updated by another order. Please try again.");
        }

        var created = await uow.OrderRepository.GetOrderByIdAsync(order.Id);
        return CreatedAtAction(nameof(GetOrder), new { id = order.Id }, MapToDto(created!));
    }

    [HttpGet("eater")]
    public async Task<ActionResult<PaginatedResult<OrderDto>>> GetEaterOrders([FromQuery] OrderParams orderParams)
    {
        var eaterId = User.GetMemberId();
        return Ok(await uow.OrderRepository.GetOrdersByEaterAsync(eaterId, orderParams));
    }

    [Authorize(Policy = "RequireCookRole")]
    [HttpGet("cook")]
    public async Task<ActionResult<PaginatedResult<OrderDto>>> GetCookOrders([FromQuery] OrderParams orderParams)
    {
        var userId = User.GetMemberId();
        var cookProfile = await uow.CookRepository.GetCookProfileByUserIdAsync(userId);
        if (cookProfile == null) return NotFound("Cook profile not found");

        return Ok(await uow.OrderRepository.GetOrdersByCookAsync(cookProfile.Id, orderParams));
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<OrderDto>> GetOrder(int id)
    {
        var order = await uow.OrderRepository.GetOrderByIdAsync(id);
        if (order == null) return NotFound();

        var callerId = User.GetMemberId();
        var isEater = order.EaterUserId == callerId;
        var isCook = order.CookProfile?.AppUserId == callerId;
        if (!isEater && !isCook) return Forbid();

        return Ok(MapToDto(order));
    }

    [Authorize(Policy = "RequireCookRole")]
    [HttpPut("{id:int}/status")]
    public async Task<ActionResult<OrderDto>> UpdateStatus(int id, UpdateOrderStatusDto dto)
    {
        var order = await uow.OrderRepository.GetOrderByIdAsync(id);
        if (order == null) return NotFound();

        var userId = User.GetMemberId();
        if (order.CookProfile?.AppUserId != userId) return Forbid();

        // Stripe orders auto-accept via webhook; cook cannot manually accept them
        if (order.PaymentMethod == PaymentMethod.Stripe
            && order.Status == OrderStatus.Pending
            && dto.NewStatus == OrderStatus.Accepted)
            return BadRequest("Stripe orders are accepted automatically when payment is confirmed");

        if (!CookTransitions.TryGetValue(order.Status, out var allowed) ||
            !allowed.Contains(dto.NewStatus))
            return BadRequest($"Cannot transition from {order.Status} to {dto.NewStatus}");

        var oldStatus = order.Status;
        order.Status = dto.NewStatus;
        order.UpdatedAt = DateTime.UtcNow;

        if (!await uow.Complete()) return BadRequest("Failed to update order status");

        await notificationService.BroadcastStatusChange(id, oldStatus, dto.NewStatus, order.UpdatedAt);

        return Ok(MapToDto(order));
    }

    [HttpPut("{id:int}/cancel")]
    public async Task<ActionResult<OrderDto>> CancelOrder(int id, CancelOrderDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Reason))
            return BadRequest("A cancellation reason is required");

        var order = await uow.OrderRepository.GetOrderByIdAsync(id);
        if (order == null) return NotFound();

        var callerId = User.GetMemberId();
        var isEater = order.EaterUserId == callerId;
        var isCook = order.CookProfile?.AppUserId == callerId;

        if (!isEater && !isCook) return Forbid();

        if (isEater && order.Status != OrderStatus.Pending)
            return BadRequest("You can only cancel an order while it is still pending");

        if (isCook && !CookCancellableStatuses.Contains(order.Status))
            return BadRequest($"Cannot cancel an order with status {order.Status}");

        order.Status = OrderStatus.Cancelled;
        order.CancellationReason = dto.Reason;
        order.UpdatedAt = DateTime.UtcNow;

        foreach (var item in order.Items)
        {
            if (item.Dish != null)
                item.Dish.PortionsRemainingToday += item.Quantity;
        }

        // Commit the cancellation first so the DB is always consistent regardless of what Stripe does.
        if (!await uow.Complete()) return BadRequest("Failed to cancel order");

        if (order.PaymentMethod == PaymentMethod.Stripe && order.PaymentStatus == PaymentStatus.Paid && !string.IsNullOrEmpty(order.StripePaymentIntentId))
        {
            try
            {
                // Idempotency key scoped to the order prevents double-refunds on retry.
                var refund = await stripeService.RefundOrderAsync(order.StripePaymentIntentId, $"refund-order-{order.Id}");
                order.PaymentStatus = PaymentStatus.Refunded;
                order.StripeRefundId = refund.Id;
                await uow.Complete();
            }
            catch (StripeException ex)
            {
                // Cancellation is already committed. Stripe refund failed but the order is cancelled.
                // The idempotency key ensures a manual retry will not double-refund.
                logger.LogWarning(ex, "Stripe refund failed for order {OrderId} (payment intent {PaymentIntentId})",
                    order.Id, order.StripePaymentIntentId);
                return BadRequest($"Order cancelled but Stripe refund failed: {ex.Message}");
            }
        }

        return Ok(MapToDto(order));
    }

    [HttpGet("{id:int}/messages")]
    public async Task<ActionResult<List<MessageDto>>> GetMessages(int id)
    {
        var order = await uow.OrderRepository.GetOrderByIdAsync(id);
        if (order == null) return NotFound();

        var callerId = User.GetMemberId();
        if (order.EaterUserId != callerId && order.CookProfile?.AppUserId != callerId)
            return Forbid();

        return Ok(await uow.MessageRepository.GetOrderMessagesAsync(id));
    }

    [HttpPost("{id:int}/messages")]
    public async Task<ActionResult<MessageDto>> SendMessage(int id, SendOrderMessageDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Content))
            return BadRequest("Message content cannot be empty");

        var order = await uow.OrderRepository.GetOrderByIdAsync(id);
        if (order == null) return NotFound();

        var callerId = User.GetMemberId();
        if (order.EaterUserId != callerId && order.CookProfile?.AppUserId != callerId)
            return Forbid();

        if (order.Status is OrderStatus.Delivered or OrderStatus.Cancelled)
            return BadRequest("Cannot send messages on a closed order");

        var message = new Message
        {
            OrderId = id,
            SenderId = callerId,
            Content = dto.Content,
            SentAt = DateTime.UtcNow
        };

        uow.MessageRepository.AddMessage(message);
        if (!await uow.Complete()) return BadRequest("Failed to send message");

        // Fetch the created message by ID to avoid race condition with concurrent messages
        var created = await uow.MessageRepository.GetMessageByIdAsync(message.Id);
        if (created == null) return BadRequest("Failed to retrieve sent message");

        await notificationService.BroadcastMessage(id, created);

        return CreatedAtAction(nameof(GetMessages), new { id }, created);
    }

    private static OrderDto MapToDto(Order o) => new()
    {
        Id = o.Id,
        EaterUserId = o.EaterUserId,
        EaterDisplayName = o.EaterUser?.DisplayName ?? string.Empty,
        CookProfileId = o.CookProfileId,
        CookKitchenName = o.CookProfile?.KitchenName ?? string.Empty,
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
            DishName = i.Dish?.Name ?? string.Empty,
            Quantity = i.Quantity,
            UnitPriceSnapshot = i.UnitPriceSnapshot
        }).ToList()
    };
}
