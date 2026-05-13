using System.Net;
using System.Net.Http.Json;
using Khanara.API.DTOs;
using Khanara.API.Entities;
using Khanara.API.Helpers;
using Khanara.API.Tests.Builders;
using Khanara.API.Tests.Helpers;
using Khanara.API.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Khanara.API.Tests.Integration.Controllers;

public class CooksControllerTests : BaseIntegrationTest
{
    public CooksControllerTests(CustomWebApplicationFactory factory) : base(factory)
    {
    }

    [Fact]
    public async Task CreateCookProfile_ValidData_CreatesAndAssignsRole()
    {
        // Arrange
        var user = await AuthHelper.CreateUserAsync("user@test.com", "UserPass123!@#", "Eater");
        var client = await CreateAuthenticatedClient("user@test.com", "UserPass123!@#", "Eater");

        var createDto = new CreateCookProfileDto
        {
            KitchenName = "My Kitchen",
            Bio = "I love cooking!",
            CuisineTags = [CuisineTag.Indian, CuisineTag.Filipino],
            ServiceZipCodes = ["12345", "67890"]
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/cooks", createDto);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var profileDto = await response.Content.ReadFromJsonAsync<CookProfileDto>();
        profileDto.Should().NotBeNull();
        profileDto!.KitchenName.Should().Be("My Kitchen");
        profileDto.Bio.Should().Be("I love cooking!");
        profileDto.AppUserId.Should().Be(user.Id);

        // Verify profile in database
        var dbProfile = await DbContext.CookProfiles
            .FirstOrDefaultAsync(p => p.AppUserId == user.Id);
        dbProfile.Should().NotBeNull();

        // Verify Cook role assigned
        var roles = await UserManager.GetRolesAsync(user);
        roles.Should().Contain("Cook");
    }

    [Fact]
    public async Task CreateCookProfile_ExistingProfile_ReturnsBadRequest()
    {
        // Arrange
        var user = await AuthHelper.CreateUserAsync("cook@test.com", "CookPass123!@#", "Cook");
        
        var existingProfile = new CookProfileBuilder()
            .ForUser(user.Id)
            .WithKitchenName("Existing Kitchen")
            .Build();
        DbContext.CookProfiles.Add(existingProfile);
        await DbContext.SaveChangesAsync();

        var client = await CreateAuthenticatedClient("cook@test.com", "CookPass123!@#", "Cook");

        var createDto = new CreateCookProfileDto
        {
            KitchenName = "New Kitchen",
            CuisineTags = [CuisineTag.Indian]
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/cooks", createDto);

        // Assert
        await response.ShouldBeBadRequest();
        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("already have a cook profile");
    }

    [Fact]
    public async Task UpdateCookProfile_OwnProfile_UpdatesSuccessfully()
    {
        // Arrange
        var cook = await AuthHelper.CreateUserAsync("cook@test.com", "CookPass123!@#", "Cook");
        
        var profile = new CookProfileBuilder()
            .ForUser(cook.Id)
            .WithKitchenName("Original Kitchen")
            .Build();
        DbContext.CookProfiles.Add(profile);
        await DbContext.SaveChangesAsync();

        var cookClient = await CreateAuthenticatedClient("cook@test.com", "CookPass123!@#", "Cook");

        var updateDto = new UpdateCookProfileDto
        {
            KitchenName = "Updated Kitchen",
            Bio = "New bio",
            IsAcceptingOrders = false
        };

        // Act
        var response = await cookClient.PutAsJsonAsync("/api/cooks/me", updateDto);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var profileDto = await response.Content.ReadFromJsonAsync<CookProfileDto>();
        profileDto.Should().NotBeNull();
        profileDto!.KitchenName.Should().Be("Updated Kitchen");
        profileDto.Bio.Should().Be("New bio");
        profileDto.IsAcceptingOrders.Should().BeFalse();

        // Verify in database
        DbContext.ChangeTracker.Clear();
        var dbProfile = await DbContext.CookProfiles.FindAsync(profile.Id);
        dbProfile!.KitchenName.Should().Be("Updated Kitchen");
        dbProfile.IsAcceptingOrders.Should().BeFalse();
    }

    [Fact]
    public async Task UpdateCookProfile_NoCookProfile_ReturnsNotFound()
    {
        // Arrange
        var cook = await AuthHelper.CreateUserAsync("cook@test.com", "CookPass123!@#", "Cook");
        var cookClient = await CreateAuthenticatedClient("cook@test.com", "CookPass123!@#", "Cook");

        var updateDto = new UpdateCookProfileDto
        {
            KitchenName = "Updated Kitchen"
        };

        // Act
        var response = await cookClient.PutAsJsonAsync("/api/cooks/me", updateDto);

        // Assert
        response.ShouldBeNotFound();
    }

    [Fact]
    public async Task GetCookProfiles_WithFilters_ReturnsMatchingProfiles()
    {
        // Arrange
        var cook1 = await AuthHelper.CreateUserAsync("cook1@test.com", "CookPass123!@#", "Cook");
        var cook2 = await AuthHelper.CreateUserAsync("cook2@test.com", "CookPass123!@#", "Cook");
        var cook3 = await AuthHelper.CreateUserAsync("cook3@test.com", "CookPass123!@#", "Cook");

        var profile1 = new CookProfileBuilder()
            .ForUser(cook1.Id)
            .WithKitchenName("Indian Kitchen")
            .Build();
        profile1.CuisineTags = [CuisineTag.Indian];

        var profile2 = new CookProfileBuilder()
            .ForUser(cook2.Id)
            .WithKitchenName("Filipino Kitchen")
            .Build();
        profile2.CuisineTags = [CuisineTag.Filipino];

        var profile3 = new CookProfileBuilder()
            .ForUser(cook3.Id)
            .WithKitchenName("Indian & Other Kitchen")
            .Build();
        profile3.CuisineTags = [CuisineTag.Indian, CuisineTag.Other];

        DbContext.CookProfiles.AddRange(profile1, profile2, profile3);
        await DbContext.SaveChangesAsync();

        // Act - Filter by Indian cuisine
        var response = await Client.GetAsync($"/api/cooks?cuisine={CuisineTag.Indian}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PaginatedResult<CookProfileDto>>();
        result.Should().NotBeNull();
        result!.Items.Should().HaveCount(2);
        result.Items.Should().AllSatisfy(c =>
            c.CuisineTags.Should().Contain(CuisineTag.Indian));
    }

    [Fact]
    public async Task GetCookProfile_ById_ReturnsWithDishes()
    {
        // Arrange
        var cook = await AuthHelper.CreateUserAsync("cook@test.com", "CookPass123!@#", "Cook");
        
        var profile = new CookProfileBuilder()
            .ForUser(cook.Id)
            .WithKitchenName("Test Kitchen")
            .Build();
        DbContext.CookProfiles.Add(profile);
        await DbContext.SaveChangesAsync();

        var dish1 = new DishBuilder()
            .WithName("Dish 1")
            .ForCook(profile.Id)
            .Build();
        var dish2 = new DishBuilder()
            .WithName("Dish 2")
            .ForCook(profile.Id)
            .Build();
        DbContext.Dishes.AddRange(dish1, dish2);
        await DbContext.SaveChangesAsync();

        // Act
        var response = await Client.GetAsync($"/api/cooks/{profile.Id}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var profileDto = await response.Content.ReadFromJsonAsync<CookProfileDto>();
        profileDto.Should().NotBeNull();
        profileDto!.Id.Should().Be(profile.Id);
        profileDto.Dishes.Should().HaveCount(2);
        profileDto.Dishes.Should().Contain(d => d.Name == "Dish 1");
        profileDto.Dishes.Should().Contain(d => d.Name == "Dish 2");
    }

    [Fact]
    public async Task GetCookProfile_NonExistent_ReturnsNotFound()
    {
        // Act
        var response = await Client.GetAsync("/api/cooks/99999");

        // Assert
        response.ShouldBeNotFound();
    }

    [Fact]
    public async Task GetCookReviews_WithPagination_ReturnsCorrectReviews()
    {
        // Arrange
        var cook = await AuthHelper.CreateUserAsync("cook@test.com", "CookPass123!@#", "Cook");
        var eater = await AuthHelper.CreateUserAsync("eater@test.com", "EaterPass123!@#", "Eater");
        
        var profile = new CookProfileBuilder()
            .ForUser(cook.Id)
            .WithKitchenName("Test Kitchen")
            .Build();
        DbContext.CookProfiles.Add(profile);
        await DbContext.SaveChangesAsync();

        var dish = new DishBuilder()
            .ForCook(profile.Id)
            .Build();
        DbContext.Dishes.Add(dish);
        await DbContext.SaveChangesAsync();

        // Create 3 delivered orders with reviews
        for (int i = 1; i <= 3; i++)
        {
            var order = new OrderBuilder()
                .ForEater(eater.Id)
                .ForCook(profile.Id)
                .WithStatus(OrderStatus.Delivered)
                .WithItem(dish.Id, 1, dish.Price)
                .Build();
            DbContext.Orders.Add(order);
            await DbContext.SaveChangesAsync();

            var review = new Review
            {
                OrderId = order.Id,
                AuthorUserId = eater.Id,
                Rating = 5,
                Comment = $"Great food {i}!",
                CreatedAt = DateTime.UtcNow.AddDays(-i)
            };
            DbContext.Reviews.Add(review);
        }
        await DbContext.SaveChangesAsync();

        // Act
        var response = await Client.GetAsync($"/api/cooks/{profile.Id}/reviews?pageNumber=1&pageSize=2");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PaginatedResult<ReviewDto>>();
        result.Should().NotBeNull();
        result!.Items.Should().HaveCount(2);
        result.Metadata.TotalCount.Should().Be(3);
        result.Metadata.TotalPages.Should().Be(2);
    }

    [Fact]
    public async Task GetMyCookProfile_AsCook_ReturnsOwnProfile()
    {
        // Arrange
        var cook = await AuthHelper.CreateUserAsync("cook@test.com", "CookPass123!@#", "Cook");
        
        var profile = new CookProfileBuilder()
            .ForUser(cook.Id)
            .WithKitchenName("My Kitchen")
            .Build();
        DbContext.CookProfiles.Add(profile);
        await DbContext.SaveChangesAsync();

        var cookClient = await CreateAuthenticatedClient("cook@test.com", "CookPass123!@#", "Cook");

        // Act
        var response = await cookClient.GetAsync("/api/cooks/me");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var profileDto = await response.Content.ReadFromJsonAsync<CookProfileDto>();
        profileDto.Should().NotBeNull();
        profileDto!.Id.Should().Be(profile.Id);
        profileDto.AppUserId.Should().Be(cook.Id);
    }

    [Fact]
    public async Task GetMyCookProfile_NoCookProfile_ReturnsNotFound()
    {
        // Arrange
        var cook = await AuthHelper.CreateUserAsync("cook@test.com", "CookPass123!@#", "Cook");
        var cookClient = await CreateAuthenticatedClient("cook@test.com", "CookPass123!@#", "Cook");

        // Act
        var response = await cookClient.GetAsync("/api/cooks/me");

        // Assert
        response.ShouldBeNotFound();
    }
}
