using System.Net;
using System.Net.Http.Json;
using Khanara.API.DTOs;
using Khanara.API.Entities;
using Khanara.API.Tests.Builders;
using Khanara.API.Tests.Infrastructure;

namespace Khanara.API.Tests.Integration.Controllers;

public class DiscoveryControllerTests : BaseIntegrationTest
{
    public DiscoveryControllerTests(CustomWebApplicationFactory factory) : base(factory)
    {
    }

    [Fact]
    public async Task GetNearMe_ValidZipCode_ReturnsCooksInArea()
    {
        // Arrange
        var cook1 = await AuthHelper.CreateUserAsync("cook1@test.com", "CookPass123!@#", "Cook");
        var profile1 = new CookProfileBuilder()
            .ForUser(cook1.Id)
            .WithKitchenName("Kitchen 1")
            .Build();
        profile1.ServiceZipCodes = ["12345", "67890"];
        DbContext.CookProfiles.Add(profile1);

        var cook2 = await AuthHelper.CreateUserAsync("cook2@test.com", "CookPass123!@#", "Cook");
        var profile2 = new CookProfileBuilder()
            .ForUser(cook2.Id)
            .WithKitchenName("Kitchen 2")
            .Build();
        profile2.ServiceZipCodes = ["99999"];
        DbContext.CookProfiles.Add(profile2);

        await DbContext.SaveChangesAsync();

        // Act
        var response = await Client.GetAsync("/api/discovery/near-me?zip=12345");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var cooks = await response.Content.ReadFromJsonAsync<List<DiscoveryCookDto>>();
        cooks.Should().NotBeNull();
        cooks.Should().HaveCount(1);
        cooks![0].KitchenName.Should().Be("Kitchen 1");
    }

    [Fact]
    public async Task GetNearMe_InvalidZipCode_ReturnsBadRequest()
    {
        // Act
        var response = await Client.GetAsync("/api/discovery/near-me?zip=abc");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("valid 5-digit zip code");
    }

    [Fact]
    public async Task GetPopular_ReturnsHighRatedCooks()
    {
        // Arrange
        var cook1 = await AuthHelper.CreateUserAsync("cook1@test.com", "CookPass123!@#", "Cook");
        var profile1 = new CookProfileBuilder()
            .ForUser(cook1.Id)
            .WithKitchenName("Popular Kitchen")
            .Build();
        profile1.AverageRating = 4.8m;
        profile1.ReviewCount = 50;
        DbContext.CookProfiles.Add(profile1);

        var cook2 = await AuthHelper.CreateUserAsync("cook2@test.com", "CookPass123!@#", "Cook");
        var profile2 = new CookProfileBuilder()
            .ForUser(cook2.Id)
            .WithKitchenName("Less Popular Kitchen")
            .Build();
        profile2.AverageRating = 3.5m;
        profile2.ReviewCount = 10;
        DbContext.CookProfiles.Add(profile2);

        await DbContext.SaveChangesAsync();

        // Act
        var response = await Client.GetAsync("/api/discovery/popular");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var cooks = await response.Content.ReadFromJsonAsync<List<DiscoveryCookDto>>();
        cooks.Should().NotBeNull();
        cooks.Should().NotBeEmpty();
    }

    [Fact]
    public async Task GetNew_ReturnsRecentlyCreatedCooks()
    {
        // Arrange
        var cook1 = await AuthHelper.CreateUserAsync("cook1@test.com", "CookPass123!@#", "Cook");
        var profile1 = new CookProfileBuilder()
            .ForUser(cook1.Id)
            .WithKitchenName("New Kitchen")
            .Build();
        profile1.CreatedAt = DateTime.UtcNow.AddDays(-1);
        DbContext.CookProfiles.Add(profile1);

        var cook2 = await AuthHelper.CreateUserAsync("cook2@test.com", "CookPass123!@#", "Cook");
        var profile2 = new CookProfileBuilder()
            .ForUser(cook2.Id)
            .WithKitchenName("Old Kitchen")
            .Build();
        profile2.CreatedAt = DateTime.UtcNow.AddMonths(-6);
        DbContext.CookProfiles.Add(profile2);

        await DbContext.SaveChangesAsync();

        // Act
        var response = await Client.GetAsync("/api/discovery/new");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var cooks = await response.Content.ReadFromJsonAsync<List<DiscoveryCookDto>>();
        cooks.Should().NotBeNull();
        cooks.Should().NotBeEmpty();
    }
}
