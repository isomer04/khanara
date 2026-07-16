using Khanara.API.Entities;
using Stripe;
using Stripe.Checkout;

namespace Khanara.API.Interfaces;

public interface IStripeService
{
    Task<(string SessionId, string SessionUrl)> CreateCheckoutSessionAsync(Order order);
    Task<Refund> RefundOrderAsync(string paymentIntentId, string? idempotencyKey = null);
    /// <summary>
    /// Explicitly expires a Checkout Session so the payment URL is dead.
    /// No-ops if the session is already expired or completed.
    /// </summary>
    Task ExpireCheckoutSessionAsync(string sessionId);
    Event ConstructWebhookEvent(string json, string signatureHeader);
}
