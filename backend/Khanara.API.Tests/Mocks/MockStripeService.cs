using System.Text.Json;
using Khanara.API.Entities;
using Khanara.API.Interfaces;
using Stripe;

namespace Khanara.API.Tests.Mocks;

public class MockStripeService : IStripeService
{
    private readonly Dictionary<string, string> _sessions = new();
    private readonly Dictionary<string, string> _refunds = new();

    public Task<(string SessionId, string SessionUrl)> CreateCheckoutSessionAsync(Order order)
    {
        var sessionId = $"cs_test_{Guid.NewGuid()}";
        var sessionUrl = $"https://checkout.stripe.com/test/{sessionId}";
        _sessions[sessionId] = order.Id.ToString();

        return Task.FromResult((sessionId, sessionUrl));
    }

    public Task<Refund> RefundOrderAsync(string paymentIntentId, string? idempotencyKey = null)
    {
        var refundId = $"re_test_{Guid.NewGuid()}";
        _refunds[refundId] = paymentIntentId;

        var refund = new Refund
        {
            Id = refundId,
            Amount = 5000, // $50.00 in cents
            Status = "succeeded"
        };

        return Task.FromResult(refund);
    }

    public Task ExpireCheckoutSessionAsync(string sessionId)
    {
        // No-op in tests — session expiry is a Stripe side-effect only
        return Task.CompletedTask;
    }

    public Event ConstructWebhookEvent(string json, string signatureHeader)
    {
        // For testing, we'll create a mock event without signature validation
        // Note: In real tests, you would mock the entire Event object via Moq
        // This is a simplified implementation for basic webhook testing
        throw new NotImplementedException("Use Moq to mock ConstructWebhookEvent in tests");
    }

    public IReadOnlyDictionary<string, string> GetSessions() => _sessions;
    public IReadOnlyDictionary<string, string> GetRefunds() => _refunds;
}
