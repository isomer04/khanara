using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Khanara.API.Entities;
using Khanara.API.Tests.Builders;
using Khanara.API.Tests.Helpers;
using Khanara.API.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Moq;
using PaymentMethod = Khanara.API.Entities.PaymentMethod;

namespace Khanara.API.Tests.Integration.Controllers;

public class JobsControllerTests : BaseIntegrationTest
{
    private const string CleanupUrl = "/api/jobs/abandoned-order-cleanup";
    private const string ResetUrl = "/api/jobs/daily-portions-reset";

    private record CleanupResult(int CancelledOrders);
    private record ResetResult(int DishesReset, bool Skipped);

    public JobsControllerTests(CustomWebApplicationFactory factory) : base(factory)
    {
    }

    private Task<HttpResponseMessage> PostAsScheduler(string url, string? token = null)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, url);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token ?? SchedulerTokens.Create());
        return Client.SendAsync(request);
    }

    private async Task<(CookProfile profile, Dish dish)> CreateDishAsync(int perBatch, int remaining)
    {
        var cook = await AuthHelper.CreateUserAsync("cook@test.com", "CookPass123!@#", "Cook");
        var profile = new CookProfileBuilder()
            .ForUser(cook.Id)
            .WithKitchenName("Test Kitchen")
            .Build();
        DbContext.CookProfiles.Add(profile);
        await DbContext.SaveChangesAsync();

        var dish = new DishBuilder()
            .WithName("Test Dish")
            .WithPrice(10m)
            .WithPortions(perBatch, remaining)
            .ForCook(profile.Id)
            .Build();
        DbContext.Dishes.Add(dish);
        await DbContext.SaveChangesAsync();

        return (profile, dish);
    }

    private async Task<Order> CreateOrderAsync(
        CookProfile profile, Dish dish, int quantity, OrderStatus status,
        PaymentMethod paymentMethod, TimeSpan age, string? stripeSessionId = null)
    {
        var eater = await UserManager.FindByEmailAsync("eater@test.com")
            ?? await AuthHelper.CreateUserAsync("eater@test.com", "EaterPass123!@#", "Eater");

        var order = new OrderBuilder()
            .ForEater(eater.Id)
            .ForCook(profile.Id)
            .WithStatus(status)
            .WithPaymentMethod(paymentMethod)
            .WithItem(dish.Id, quantity, dish.Price)
            .Build();
        order.CreatedAt = DateTime.UtcNow - age;
        order.StripeSessionId = stripeSessionId;
        DbContext.Orders.Add(order);
        await DbContext.SaveChangesAsync();

        return order;
    }

    private async Task<int> RemainingPortionsAsync(int dishId)
    {
        DbContext.ChangeTracker.Clear();
        var dish = await DbContext.Dishes.AsNoTracking().SingleAsync(d => d.Id == dishId);
        return dish.PortionsRemainingToday;
    }

    // ── Authentication ────────────────────────────────────────────────────────

    [Theory]
    [InlineData(CleanupUrl)]
    [InlineData(ResetUrl)]
    public async Task JobEndpoints_WithoutToken_ReturnUnauthorized(string url)
    {
        var response = await Client.PostAsync(url, null);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task JobEndpoints_WithAppUserToken_ReturnUnauthorized()
    {
        var admin = await CreateAuthenticatedClient("admin@test.com", "AdminPass123!@#", "Admin");

        var response = await admin.PostAsync(CleanupUrl, null);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task JobEndpoints_WithWrongAudience_ReturnUnauthorized()
    {
        var response = await PostAsScheduler(CleanupUrl,
            SchedulerTokens.Create(audience: "https://someone-else.example/api/jobs"));

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task JobEndpoints_WithOtherServiceAccount_ReturnForbidden()
    {
        var response = await PostAsScheduler(CleanupUrl,
            SchedulerTokens.Create(email: "attacker@other-project.iam.gserviceaccount.com"));

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task JobEndpoints_WithUnverifiedEmail_ReturnForbidden()
    {
        var response = await PostAsScheduler(CleanupUrl, SchedulerTokens.Create(emailVerified: false));

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // ── Abandoned order cleanup ───────────────────────────────────────────────

    [Fact]
    public async Task AbandonedOrderCleanup_CancelsOnlyStaleUnpaidStripeOrders()
    {
        var (profile, dish) = await CreateDishAsync(perBatch: 10, remaining: 4);
        var stale = await CreateOrderAsync(profile, dish, 2, OrderStatus.Pending,
            PaymentMethod.Stripe, TimeSpan.FromHours(1), stripeSessionId: "cs_test_stale");
        var recent = await CreateOrderAsync(profile, dish, 1, OrderStatus.Pending,
            PaymentMethod.Stripe, TimeSpan.FromMinutes(5));
        var cash = await CreateOrderAsync(profile, dish, 3, OrderStatus.Pending,
            PaymentMethod.Cash, TimeSpan.FromHours(1));

        var response = await PostAsScheduler(CleanupUrl);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        (await response.Content.ReadFromJsonAsync<CleanupResult>())!.CancelledOrders.Should().Be(1);

        DbContext.ChangeTracker.Clear();
        var orders = await DbContext.Orders.AsNoTracking().ToDictionaryAsync(o => o.Id);
        orders[stale.Id].Status.Should().Be(OrderStatus.Cancelled);
        orders[recent.Id].Status.Should().Be(OrderStatus.Pending);
        orders[cash.Id].Status.Should().Be(OrderStatus.Pending);
        (await RemainingPortionsAsync(dish.Id)).Should().Be(6);

        Factory.MockStripeService.Verify(
            s => s.ExpireCheckoutSessionAsync("cs_test_stale"), Times.Once);
    }

    [Fact]
    public async Task AbandonedOrderCleanup_RunTwice_RestoresPortionsOnce()
    {
        var (profile, dish) = await CreateDishAsync(perBatch: 10, remaining: 4);
        await CreateOrderAsync(profile, dish, 2, OrderStatus.Pending,
            PaymentMethod.Stripe, TimeSpan.FromHours(1));

        await PostAsScheduler(CleanupUrl);
        var second = await PostAsScheduler(CleanupUrl);

        (await second.Content.ReadFromJsonAsync<CleanupResult>())!.CancelledOrders.Should().Be(0);
        (await RemainingPortionsAsync(dish.Id)).Should().Be(6);
    }

    // ── Daily portions reset ──────────────────────────────────────────────────

    [Fact]
    public async Task DailyPortionsReset_RestoresBatchMinusActiveOrders()
    {
        var (profile, dish) = await CreateDishAsync(perBatch: 10, remaining: 1);
        await CreateOrderAsync(profile, dish, 3, OrderStatus.Accepted,
            PaymentMethod.Cash, TimeSpan.FromHours(2));
        await CreateOrderAsync(profile, dish, 4, OrderStatus.Delivered,
            PaymentMethod.Cash, TimeSpan.FromHours(5));

        var response = await PostAsScheduler(ResetUrl);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<ResetResult>();
        result!.Skipped.Should().BeFalse();
        result.DishesReset.Should().Be(1);
        (await RemainingPortionsAsync(dish.Id)).Should().Be(7);
    }

    [Fact]
    public async Task DailyPortionsReset_SecondRunSameDay_IsSkipped()
    {
        var (_, dish) = await CreateDishAsync(perBatch: 10, remaining: 1);

        await PostAsScheduler(ResetUrl);

        // Portions sold after the reset must not come back on a retried trigger.
        DbContext.ChangeTracker.Clear();
        var tracked = await DbContext.Dishes.SingleAsync(d => d.Id == dish.Id);
        tracked.PortionsRemainingToday = 3;
        await DbContext.SaveChangesAsync();

        var second = await PostAsScheduler(ResetUrl);

        var result = await second.Content.ReadFromJsonAsync<ResetResult>();
        result!.Skipped.Should().BeTrue();
        (await RemainingPortionsAsync(dish.Id)).Should().Be(3);
    }
}
