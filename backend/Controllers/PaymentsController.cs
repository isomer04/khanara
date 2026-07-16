using Khanara.API.Data;
using Khanara.API.DTOs;
using Khanara.API.Entities;
using Khanara.API.Extensions;
using Khanara.API.Interfaces;
using Khanara.API.SignalR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Stripe;
using Stripe.Checkout;

namespace Khanara.API.Controllers;

[ApiController]
[Route("api/payments")]
public class PaymentsController(
    IUnitOfWork uow,
    IStripeService stripe,
    AppDbContext context,
    IHubContext<OrderHub> orderHub,
    ILogger<PaymentsController> logger) : ControllerBase
{
    [Authorize]
    [HttpPost("checkout-session")]
    public async Task<ActionResult<CheckoutSessionResponseDto>> CreateCheckoutSession(CreateCheckoutSessionDto dto)
    {
        var userId = User.GetMemberId();
        var order = await uow.OrderRepository.GetOrderByIdAsync(dto.OrderId);

        if (order == null) return NotFound("Order not found");
        if (order.EaterUserId != userId) return Forbid();
        if (order.PaymentMethod != Khanara.API.Entities.PaymentMethod.Stripe)
            return BadRequest("This order is not a Stripe order");
        if (order.PaymentStatus != Khanara.API.Entities.PaymentStatus.Pending)
            return BadRequest("Order has already been paid");
        if (order.Status == OrderStatus.Cancelled)
            return BadRequest("Order is cancelled");
        if (!string.IsNullOrEmpty(order.StripeSessionId))
            return Conflict("A checkout session already exists for this order");

        var (sessionId, sessionUrl) = await stripe.CreateCheckoutSessionAsync(order);

        order.StripeSessionId = sessionId;
        order.UpdatedAt = DateTime.UtcNow;
        if (!await uow.Complete())
            return BadRequest("Failed to persist checkout session");

        return Ok(new CheckoutSessionResponseDto { SessionUrl = sessionUrl });
    }

    // Stripe calls this — no auth, signature is verified manually
    [AllowAnonymous]
    [HttpPost("webhook")]
    public async Task<IActionResult> Webhook()
    {
        string json;
        try
        {
            using var reader = new StreamReader(HttpContext.Request.Body);
            json = await reader.ReadToEndAsync();
        }
        catch
        {
            return BadRequest("Failed to read request body");
        }

        var signatureHeader = Request.Headers["Stripe-Signature"].ToString();
        if (string.IsNullOrEmpty(signatureHeader))
            return BadRequest("Missing Stripe-Signature header");

        Event stripeEvent;
        try
        {
            stripeEvent = stripe.ConstructWebhookEvent(json, signatureHeader);
        }
        catch (StripeException ex)
        {
            logger.LogWarning("Stripe webhook signature verification failed: {Message}", ex.Message);
            return BadRequest("Invalid webhook signature");
        }

        // Idempotency: skip already-processed events
        var alreadyProcessed = await context.StripeWebhookEvents
            .AnyAsync(e => e.StripeEventId == stripeEvent.Id);
        if (alreadyProcessed)
            return Ok();

        OrderStatusChangedDto? statusChange = null;
        switch (stripeEvent.Type)
        {
            case "checkout.session.completed":
                statusChange = await HandleCheckoutCompleted(stripeEvent);
                break;
            case "charge.refunded":
                await HandleChargeRefunded(stripeEvent);
                break;
        }

        // Record event as processed regardless of type to prevent double-handling on retries
        try
        {
            context.StripeWebhookEvents.Add(new StripeWebhookEvent
            {
                StripeEventId = stripeEvent.Id,
                ProcessedAt = DateTime.UtcNow
            });
            await context.SaveChangesAsync();
        }
        catch (DbUpdateException ex)
        {
            // Re-check idempotency marker to detect concurrent duplicate insert
            var processedConcurrently = await context.StripeWebhookEvents
                .AnyAsync(e => e.StripeEventId == stripeEvent.Id);
            if (processedConcurrently)
            {
                logger.LogInformation("Webhook event {EventId} was processed concurrently, ignoring duplicate", stripeEvent.Id);
                return Ok();
            }

            logger.LogError(ex, "Failed to persist webhook event {EventId}", stripeEvent.Id);
            throw;
        }

        if (statusChange != null)
        {
            await orderHub.Clients.Group($"order-{statusChange.OrderId}").SendAsync("OrderStatusChanged", statusChange);
        }

        return Ok();
    }

    private async Task<OrderStatusChangedDto?> HandleCheckoutCompleted(Event stripeEvent)
    {
        var session = stripeEvent.Data.Object as Session;
        if (session == null) return null;

        var order = await context.Orders
            .Include(o => o.CookProfile)
            .FirstOrDefaultAsync(o => o.StripeSessionId == session.Id);
        if (order == null)
        {
            logger.LogWarning("checkout.session.completed: no order found for session {SessionId}", session.Id);
            return null;
        }

        var oldStatus = order.Status;
        order.PaymentStatus = Khanara.API.Entities.PaymentStatus.Paid;
        order.Status = OrderStatus.Accepted;
        order.StripePaymentIntentId = session.PaymentIntentId;
        order.UpdatedAt = DateTime.UtcNow;

        return new OrderStatusChangedDto
        {
            OrderId = order.Id,
            OldStatus = oldStatus.ToString(),
            NewStatus = OrderStatus.Accepted.ToString(),
            ChangedAt = order.UpdatedAt
        };
    }

    private async Task HandleChargeRefunded(Event stripeEvent)
    {
        var charge = stripeEvent.Data.Object as Charge;
        if (charge == null) return;

        var order = await context.Orders
            .FirstOrDefaultAsync(o => o.StripePaymentIntentId == charge.PaymentIntentId);
        if (order == null)
        {
            logger.LogWarning("charge.refunded: no order found for payment intent {PaymentIntentId}", charge.PaymentIntentId);
            return;
        }

        order.PaymentStatus = Khanara.API.Entities.PaymentStatus.Refunded;
        // Charge.Refunds is a collection; take the first refund ID if available
        if (charge.Refunds?.Data?.Count > 0)
        {
            order.StripeRefundId = charge.Refunds.Data[0].Id;
        }
        order.UpdatedAt = DateTime.UtcNow;
    }
}
