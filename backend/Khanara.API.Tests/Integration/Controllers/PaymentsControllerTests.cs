using System.Net;
using System.Net.Http.Json;
using System.Text;
using Khanara.API.DTOs;
using Khanara.API.Entities;
using Khanara.API.Tests.Builders;
using Khanara.API.Tests.Helpers;
using Khanara.API.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Moq;
using Stripe;
using PaymentMethod = Khanara.API.Entities.PaymentMethod;

namespace Khanara.API.Tests.Integration.Controllers;

public class PaymentsControllerTests : BaseIntegrationTest
{
    public PaymentsControllerTests(CustomWebApplicationFactory factory) : base(factory)
    {
    }

    private async Task<(AppUser eater, AppUser cook, CookProfile profile, Dish dish, Order order)> CreateStripeOrderScenario(
        OrderStatus status = OrderStatus.Pending,
        PaymentStatus paymentStatus = PaymentStatus.Pending)
    {
        var eater = await AuthHelper.CreateUserAsync("eater@test.com", "EaterPass123!@#", "Eater");
        var cook = await AuthHelper.CreateUserAsync("cook@test.com", "CookPass123!@#", "Cook");

        var profile = new CookProfileBuilder()
            .ForUser(cook.Id)
            .WithKitchenName("Test Kitchen")
            .Build();
        DbContext.CookProfiles.Add(profile);
        await DbContext.SaveChangesAsync();

        var dish = new DishBuilder()
            .WithName("Test Dish")
            .WithPrice(25.99m)
            .WithPortions(10)
            .ForCook(profile.Id)
            .Build();
        DbContext.Dishes.Add(dish);
        await DbContext.SaveChangesAsync();

        var order = new OrderBuilder()
            .ForEater(eater.Id)
            .ForCook(profile.Id)
            .WithStatus(status)
            .WithPaymentMethod(PaymentMethod.Stripe)
            .WithItem(dish.Id, 2, dish.Price)
            .Build();
        order.PaymentStatus = paymentStatus;
        order.TotalAmount = 2 * dish.Price;
        DbContext.Orders.Add(order);
        await DbContext.SaveChangesAsync();

        return (eater, cook, profile, dish, order);
    }

    [Fact]
    public async Task CreateCheckoutSession_ValidOrder_ReturnsSessionUrl()
    {
        // Arrange
        var (eater, cook, profile, dish, order) = await CreateStripeOrderScenario();
        var client = await CreateAuthenticatedClient("eater@test.com", "EaterPass123!@#", "Eater");

        // Setup mock Stripe service
        Factory.MockStripeService
            .Setup(s => s.CreateCheckoutSessionAsync(It.IsAny<Order>()))
            .ReturnsAsync(("cs_test_123", "https://checkout.stripe.com/test"));

        var dto = new CreateCheckoutSessionDto
        {
            OrderId = order.Id
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/payments/checkout-session", dto);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<CheckoutSessionResponseDto>();
        result.Should().NotBeNull();
        result!.SessionUrl.Should().Be("https://checkout.stripe.com/test");

        // Verify mock was called
        Factory.MockStripeService.Verify(
            s => s.CreateCheckoutSessionAsync(It.Is<Order>(o => o.Id == order.Id)),
            Times.Once);

        // Verify session ID saved to database
        DbContext.ChangeTracker.Clear();
        var updatedOrder = await DbContext.Orders.FindAsync(order.Id);
        updatedOrder!.StripeSessionId.Should().Be("cs_test_123");
    }

    [Fact]
    public async Task CreateCheckoutSession_NonExistentOrder_ReturnsNotFound()
    {
        // Arrange
        var client = await CreateAuthenticatedClient("eater@test.com", "EaterPass123!@#", "Eater");

        var dto = new CreateCheckoutSessionDto
        {
            OrderId = 99999
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/payments/checkout-session", dto);

        // Assert
        response.ShouldBeNotFound();
    }

    [Fact]
    public async Task CreateCheckoutSession_AnotherUsersOrder_ReturnsForbidden()
    {
        // Arrange
        var (eater, cook, profile, dish, order) = await CreateStripeOrderScenario();
        
        // Create a different eater
        var otherEater = await AuthHelper.CreateUserAsync("othereater@test.com", "EaterPass123!@#", "Eater");
        var otherClient = await CreateAuthenticatedClient("othereater@test.com", "EaterPass123!@#", "Eater");

        var dto = new CreateCheckoutSessionDto
        {
            OrderId = order.Id
        };

        // Act
        var response = await otherClient.PostAsJsonAsync("/api/payments/checkout-session", dto);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task CreateCheckoutSession_NonStripeOrder_ReturnsBadRequest()
    {
        // Arrange
        var (eater, cook, profile, dish, order) = await CreateStripeOrderScenario();
        order.PaymentMethod = PaymentMethod.Cash;
        await DbContext.SaveChangesAsync();

        var client = await CreateAuthenticatedClient("eater@test.com", "EaterPass123!@#", "Eater");

        var dto = new CreateCheckoutSessionDto
        {
            OrderId = order.Id
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/payments/checkout-session", dto);

        // Assert
        await response.ShouldBeBadRequest();
        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("not a Stripe order");
    }

    [Fact]
    public async Task CreateCheckoutSession_AlreadyPaidOrder_ReturnsBadRequest()
    {
        // Arrange
        var (eater, cook, profile, dish, order) = await CreateStripeOrderScenario(
            paymentStatus: PaymentStatus.Paid);

        var client = await CreateAuthenticatedClient("eater@test.com", "EaterPass123!@#", "Eater");

        var dto = new CreateCheckoutSessionDto
        {
            OrderId = order.Id
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/payments/checkout-session", dto);

        // Assert
        await response.ShouldBeBadRequest();
        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("already been paid");
    }

    [Fact]
    public async Task CreateCheckoutSession_CancelledOrder_ReturnsBadRequest()
    {
        // Arrange
        var (eater, cook, profile, dish, order) = await CreateStripeOrderScenario(
            status: OrderStatus.Cancelled);

        var client = await CreateAuthenticatedClient("eater@test.com", "EaterPass123!@#", "Eater");

        var dto = new CreateCheckoutSessionDto
        {
            OrderId = order.Id
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/payments/checkout-session", dto);

        // Assert
        await response.ShouldBeBadRequest();
        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("cancelled");
    }

    [Fact]
    public async Task CreateCheckoutSession_ExistingSession_ReturnsConflict()
    {
        // Arrange
        var (eater, cook, profile, dish, order) = await CreateStripeOrderScenario();
        order.StripeSessionId = "cs_existing_123";
        await DbContext.SaveChangesAsync();

        var client = await CreateAuthenticatedClient("eater@test.com", "EaterPass123!@#", "Eater");

        var dto = new CreateCheckoutSessionDto
        {
            OrderId = order.Id
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/payments/checkout-session", dto);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("already exists");
    }

    [Fact]
    public async Task ProcessWebhook_CheckoutSessionCompleted_UpdatesOrderStatus()
    {
        // Arrange
        var (eater, cook, profile, dish, order) = await CreateStripeOrderScenario();
        order.StripeSessionId = "cs_test_123";
        await DbContext.SaveChangesAsync();

        // Create mock Stripe event
        var stripeEvent = new Event
        {
            Id = "evt_test_123",
            Type = "checkout.session.completed",
            Data = new EventData
            {
                Object = new Stripe.Checkout.Session
                {
                    Id = "cs_test_123",
                    PaymentIntentId = "pi_test_123"
                }
            }
        };

        Factory.MockStripeService
            .Setup(s => s.ConstructWebhookEvent(It.IsAny<string>(), It.IsAny<string>()))
            .Returns(stripeEvent);

        var json = "{\"id\":\"evt_test_123\",\"type\":\"checkout.session.completed\"}";
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        var request = new HttpRequestMessage(HttpMethod.Post, "/api/payments/webhook")
        {
            Content = content
        };
        request.Headers.Add("Stripe-Signature", "test_signature");

        // Act
        var response = await Client.SendAsync(request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        // Verify order updated
        DbContext.ChangeTracker.Clear();
        var updatedOrder = await DbContext.Orders.FindAsync(order.Id);
        updatedOrder.Should().NotBeNull();
        updatedOrder!.PaymentStatus.Should().Be(PaymentStatus.Paid);
        updatedOrder.Status.Should().Be(OrderStatus.Accepted);
        updatedOrder.StripePaymentIntentId.Should().Be("pi_test_123");

        // Verify webhook event recorded
        var webhookEvent = await DbContext.StripeWebhookEvents
            .FirstOrDefaultAsync(e => e.StripeEventId == "evt_test_123");
        webhookEvent.Should().NotBeNull();
    }

    [Fact]
    public async Task ProcessWebhook_ChargeRefunded_UpdatesPaymentStatus()
    {
        // Arrange
        var (eater, cook, profile, dish, order) = await CreateStripeOrderScenario(
            status: OrderStatus.Cancelled,
            paymentStatus: PaymentStatus.Paid);
        order.StripePaymentIntentId = "pi_test_123";
        await DbContext.SaveChangesAsync();

        // Create mock Stripe event with refund
        var refund = new Refund { Id = "re_test_123" };
        var charge = new Charge
        {
            PaymentIntentId = "pi_test_123",
            Refunds = new StripeList<Refund>
            {
                Data = new List<Refund> { refund }
            }
        };

        var stripeEvent = new Event
        {
            Id = "evt_refund_123",
            Type = "charge.refunded",
            Data = new EventData
            {
                Object = charge
            }
        };

        Factory.MockStripeService
            .Setup(s => s.ConstructWebhookEvent(It.IsAny<string>(), It.IsAny<string>()))
            .Returns(stripeEvent);

        var json = "{\"id\":\"evt_refund_123\",\"type\":\"charge.refunded\"}";
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        var request = new HttpRequestMessage(HttpMethod.Post, "/api/payments/webhook")
        {
            Content = content
        };
        request.Headers.Add("Stripe-Signature", "test_signature");

        // Act
        var response = await Client.SendAsync(request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        // Verify payment status updated
        DbContext.ChangeTracker.Clear();
        var updatedOrder = await DbContext.Orders.FindAsync(order.Id);
        updatedOrder.Should().NotBeNull();
        updatedOrder!.PaymentStatus.Should().Be(PaymentStatus.Refunded);
        updatedOrder.StripeRefundId.Should().Be("re_test_123");

        // Verify webhook event recorded
        var webhookEvent = await DbContext.StripeWebhookEvents
            .FirstOrDefaultAsync(e => e.StripeEventId == "evt_refund_123");
        webhookEvent.Should().NotBeNull();
    }

    [Fact]
    public async Task ProcessWebhook_InvalidSignature_ReturnsBadRequest()
    {
        // Arrange
        Factory.MockStripeService
            .Setup(s => s.ConstructWebhookEvent(It.IsAny<string>(), It.IsAny<string>()))
            .Throws(new StripeException("Invalid signature"));

        var json = "{\"id\":\"evt_test_123\",\"type\":\"checkout.session.completed\"}";
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        var request = new HttpRequestMessage(HttpMethod.Post, "/api/payments/webhook")
        {
            Content = content
        };
        request.Headers.Add("Stripe-Signature", "invalid_signature");

        // Act
        var response = await Client.SendAsync(request);

        // Assert
        await response.ShouldBeBadRequest();
        var responseContent = await response.Content.ReadAsStringAsync();
        responseContent.Should().Contain("Invalid webhook signature");
    }

    [Fact]
    public async Task ProcessWebhook_MissingSignature_ReturnsBadRequest()
    {
        // Arrange
        var json = "{\"id\":\"evt_test_123\",\"type\":\"checkout.session.completed\"}";
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        var request = new HttpRequestMessage(HttpMethod.Post, "/api/payments/webhook")
        {
            Content = content
        };
        // No Stripe-Signature header

        // Act
        var response = await Client.SendAsync(request);

        // Assert
        await response.ShouldBeBadRequest();
        var responseContent = await response.Content.ReadAsStringAsync();
        responseContent.Should().Contain("Missing Stripe-Signature header");
    }

    [Fact]
    public async Task ProcessWebhook_TamperedPayload_RejectsRequest()
    {
        // Arrange - Simulate tampered payload that doesn't match signature
        Factory.MockStripeService
            .Setup(s => s.ConstructWebhookEvent(It.IsAny<string>(), It.IsAny<string>()))
            .Throws(new StripeException("Signature verification failed"));

        var json = "{\"id\":\"evt_tampered\",\"type\":\"checkout.session.completed\",\"data\":{\"object\":{\"amount_total\":1}}}";
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        var request = new HttpRequestMessage(HttpMethod.Post, "/api/payments/webhook")
        {
            Content = content
        };
        request.Headers.Add("Stripe-Signature", "valid_signature_for_different_payload");

        // Act
        var response = await Client.SendAsync(request);

        // Assert
        await response.ShouldBeBadRequest();
        var responseContent = await response.Content.ReadAsStringAsync();
        responseContent.Should().Contain("webhook signature", "Should reject tampered payloads");
    }

    [Fact]
    public async Task ProcessWebhook_DuplicateEvent_EnsuresIdempotency()
    {
        // Arrange
        var (eater, cook, profile, dish, order) = await CreateStripeOrderScenario();
        order.StripeSessionId = "cs_test_123";
        await DbContext.SaveChangesAsync();

        // Record event as already processed
        DbContext.StripeWebhookEvents.Add(new StripeWebhookEvent
        {
            StripeEventId = "evt_duplicate_123",
            ProcessedAt = DateTime.UtcNow
        });
        await DbContext.SaveChangesAsync();

        var stripeEvent = new Event
        {
            Id = "evt_duplicate_123",
            Type = "checkout.session.completed",
            Data = new EventData
            {
                Object = new Stripe.Checkout.Session
                {
                    Id = "cs_test_123",
                    PaymentIntentId = "pi_test_123"
                }
            }
        };

        Factory.MockStripeService
            .Setup(s => s.ConstructWebhookEvent(It.IsAny<string>(), It.IsAny<string>()))
            .Returns(stripeEvent);

        var json = "{\"id\":\"evt_duplicate_123\",\"type\":\"checkout.session.completed\"}";
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        var request = new HttpRequestMessage(HttpMethod.Post, "/api/payments/webhook")
        {
            Content = content
        };
        request.Headers.Add("Stripe-Signature", "test_signature");

        // Act
        var response = await Client.SendAsync(request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        // Verify order NOT updated (still pending)
        DbContext.ChangeTracker.Clear();
        var updatedOrder = await DbContext.Orders.FindAsync(order.Id);
        updatedOrder!.PaymentStatus.Should().Be(PaymentStatus.Pending);
        updatedOrder.Status.Should().Be(OrderStatus.Pending);
    }

    [Fact]
    public async Task ProcessWebhook_UnknownEventType_RecordsEventWithoutProcessing()
    {
        // Arrange
        var stripeEvent = new Event
        {
            Id = "evt_unknown_123",
            Type = "payment_intent.created", // Not handled
            Data = new EventData()
        };

        Factory.MockStripeService
            .Setup(s => s.ConstructWebhookEvent(It.IsAny<string>(), It.IsAny<string>()))
            .Returns(stripeEvent);

        var json = "{\"id\":\"evt_unknown_123\",\"type\":\"payment_intent.created\"}";
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        var request = new HttpRequestMessage(HttpMethod.Post, "/api/payments/webhook")
        {
            Content = content
        };
        request.Headers.Add("Stripe-Signature", "test_signature");

        // Act
        var response = await Client.SendAsync(request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        // Verify event recorded even though not processed
        var webhookEvent = await DbContext.StripeWebhookEvents
            .FirstOrDefaultAsync(e => e.StripeEventId == "evt_unknown_123");
        webhookEvent.Should().NotBeNull();
    }

    [Fact]
    public async Task CancelPaidOrder_InitiatesStripeRefund()
    {
        // Arrange
        var (eater, cook, profile, dish, order) = await CreateStripeOrderScenario(
            status: OrderStatus.Pending,
            paymentStatus: PaymentStatus.Paid);
        order.StripePaymentIntentId = "pi_test_123";
        await DbContext.SaveChangesAsync();

        // Setup mock refund
        var mockRefund = new Refund { Id = "re_test_123" };
        Factory.MockStripeService
            .Setup(s => s.RefundOrderAsync("pi_test_123", $"refund-order-{order.Id}"))
            .ReturnsAsync(mockRefund);

        var eaterClient = await CreateAuthenticatedClient("eater@test.com", "EaterPass123!@#", "Eater");

        var cancelDto = new CancelOrderDto
        {
            Reason = "Changed my mind"
        };

        // Act
        var response = await eaterClient.PutAsJsonAsync($"/api/orders/{order.Id}/cancel", cancelDto);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        // Verify refund was called
        Factory.MockStripeService.Verify(
            s => s.RefundOrderAsync("pi_test_123", $"refund-order-{order.Id}"),
            Times.Once);

        // Verify order updated
        DbContext.ChangeTracker.Clear();
        var updatedOrder = await DbContext.Orders.FindAsync(order.Id);
        updatedOrder!.Status.Should().Be(OrderStatus.Cancelled);
        updatedOrder.PaymentStatus.Should().Be(PaymentStatus.Refunded);
        updatedOrder.StripeRefundId.Should().Be("re_test_123");
    }
}
