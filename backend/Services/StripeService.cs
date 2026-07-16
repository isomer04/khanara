using Khanara.API.Entities;
using Khanara.API.Helpers;
using Khanara.API.Interfaces;
using Microsoft.Extensions.Options;
using Stripe;
using Stripe.Checkout;

namespace Khanara.API.Services;

public class StripeService(IOptions<StripeSettings> opts) : IStripeService
{
    private readonly StripeSettings _settings = opts.Value;

    public async Task<(string SessionId, string SessionUrl)> CreateCheckoutSessionAsync(Order order)
    {
        var options = new SessionCreateOptions
        {
            PaymentMethodTypes = ["card"],
            LineItems = order.Items.Select(item => new SessionLineItemOptions
            {
                PriceData = new SessionLineItemPriceDataOptions
                {
                    Currency = "usd",
                    // Stripe requires integer cents
                    UnitAmount = (long)Math.Round(item.UnitPriceSnapshot * 100, MidpointRounding.AwayFromZero),
                    ProductData = new SessionLineItemPriceDataProductDataOptions
                    {
                        Name = item.Dish?.Name ?? $"Dish #{item.DishId}"
                    }
                },
                Quantity = item.Quantity
            }).ToList(),
            Mode = "payment",
            SuccessUrl = string.Format(_settings.SuccessUrl, order.Id),
            CancelUrl = string.Format(_settings.CancelUrl, order.Id),
            Metadata = new Dictionary<string, string>
            {
                ["orderId"] = order.Id.ToString()
            }
        };

        var service = new SessionService();
        var session = await service.CreateAsync(options);
        return (session.Id, session.Url);
    }

    public async Task<Refund> RefundOrderAsync(string paymentIntentId, string? idempotencyKey = null)
    {
        var options = new RefundCreateOptions
        {
            PaymentIntent = paymentIntentId
        };
        var requestOptions = idempotencyKey != null ? new RequestOptions { IdempotencyKey = idempotencyKey } : null;
        var service = new RefundService();
        return await service.CreateAsync(options, requestOptions);
    }

    public async Task ExpireCheckoutSessionAsync(string sessionId)
    {
        try
        {
            var service = new SessionService();
            await service.ExpireAsync(sessionId);
        }
        catch (StripeException ex) when (
            ex.StripeError?.Code == "resource_missing" ||
            ex.StripeError?.Code == "checkout_session_expired" ||
            ex.StripeError?.Code == "checkout_session_completed")
        {
            // Already expired or completed — nothing to do
        }
    }

    public Event ConstructWebhookEvent(string json, string signatureHeader)
    {
        return EventUtility.ConstructEvent(json, signatureHeader, _settings.WebhookSecret);
    }
}
