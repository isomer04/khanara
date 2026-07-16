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

public class FavoritesControllerTests : BaseIntegrationTest
{
    public FavoritesControllerTests(CustomWebApplicationFactory factory) : base(factory)
    {
    }

    [Fact]
    public async Task AddFavorite_ValidCook_CreatesSuccessfully()
    {
        // Arrange
        var eater = await AuthHelper.CreateUserAsync("eater@test.com", "EaterPass123!@#", "Eater");
        var cook = await AuthHelper.CreateUserAsync("cook@test.com", "CookPass123!@#", "Cook");
        
        var profile = new CookProfileBuilder()
            .ForUser(cook.Id)
            .WithKitchenName("Test Kitchen")
            .Build();
        DbContext.CookProfiles.Add(profile);
        await DbContext.SaveChangesAsync();

        var eaterClient = await CreateAuthenticatedClient("eater@test.com", "EaterPass123!@#", "Eater");

        // Act
        var response = await eaterClient.PostAsync($"/api/favorites/{profile.Id}", null);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);

        // Verify in database
        var favorite = await DbContext.Favorites
            .FirstOrDefaultAsync(f => f.EaterUserId == eater.Id && f.CookProfileId == profile.Id);
        favorite.Should().NotBeNull();
    }

    [Fact]
    public async Task AddFavorite_AlreadyFavorited_IdempotentBehavior()
    {
        // Arrange
        var eater = await AuthHelper.CreateUserAsync("eater@test.com", "EaterPass123!@#", "Eater");
        var cook = await AuthHelper.CreateUserAsync("cook@test.com", "CookPass123!@#", "Cook");
        
        var profile = new CookProfileBuilder()
            .ForUser(cook.Id)
            .WithKitchenName("Test Kitchen")
            .Build();
        DbContext.CookProfiles.Add(profile);
        await DbContext.SaveChangesAsync();

        // Add existing favorite
        DbContext.Favorites.Add(new Favorite
        {
            EaterUserId = eater.Id,
            CookProfileId = profile.Id
        });
        await DbContext.SaveChangesAsync();

        var eaterClient = await CreateAuthenticatedClient("eater@test.com", "EaterPass123!@#", "Eater");

        // Act
        var response = await eaterClient.PostAsync($"/api/favorites/{profile.Id}", null);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        // Verify still only one favorite
        var count = await DbContext.Favorites
            .CountAsync(f => f.EaterUserId == eater.Id && f.CookProfileId == profile.Id);
        count.Should().Be(1);
    }

    [Fact]
    public async Task AddFavorite_OwnKitchen_ReturnsBadRequest()
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
        var response = await cookClient.PostAsync($"/api/favorites/{profile.Id}", null);

        // Assert
        await response.ShouldBeBadRequest();
        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("cannot favorite your own kitchen");
    }

    [Fact]
    public async Task RemoveFavorite_ExistingFavorite_DeletesSuccessfully()
    {
        // Arrange
        var eater = await AuthHelper.CreateUserAsync("eater@test.com", "EaterPass123!@#", "Eater");
        var cook = await AuthHelper.CreateUserAsync("cook@test.com", "CookPass123!@#", "Cook");
        
        var profile = new CookProfileBuilder()
            .ForUser(cook.Id)
            .WithKitchenName("Test Kitchen")
            .Build();
        DbContext.CookProfiles.Add(profile);
        await DbContext.SaveChangesAsync();

        var favorite = new Favorite
        {
            EaterUserId = eater.Id,
            CookProfileId = profile.Id
        };
        DbContext.Favorites.Add(favorite);
        await DbContext.SaveChangesAsync();

        var eaterClient = await CreateAuthenticatedClient("eater@test.com", "EaterPass123!@#", "Eater");

        // Act
        var response = await eaterClient.DeleteAsync($"/api/favorites/{profile.Id}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Verify deleted
        var dbFavorite = await DbContext.Favorites
            .FirstOrDefaultAsync(f => f.EaterUserId == eater.Id && f.CookProfileId == profile.Id);
        dbFavorite.Should().BeNull();
    }

    [Fact]
    public async Task GetFavorites_WithPagination_ReturnsCorrectFavorites()
    {
        // Arrange
        var eater = await AuthHelper.CreateUserAsync("eater@test.com", "EaterPass123!@#", "Eater");
        
        // Create 3 cooks
        for (int i = 1; i <= 3; i++)
        {
            var cook = await AuthHelper.CreateUserAsync($"cook{i}@test.com", "CookPass123!@#", "Cook");
            var profile = new CookProfileBuilder()
                .ForUser(cook.Id)
                .WithKitchenName($"Kitchen {i}")
                .Build();
            DbContext.CookProfiles.Add(profile);
            await DbContext.SaveChangesAsync();

            DbContext.Favorites.Add(new Favorite
            {
                EaterUserId = eater.Id,
                CookProfileId = profile.Id
            });
        }
        await DbContext.SaveChangesAsync();

        var eaterClient = await CreateAuthenticatedClient("eater@test.com", "EaterPass123!@#", "Eater");

        // Act
        var response = await eaterClient.GetAsync("/api/favorites?pageNumber=1&pageSize=2");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PaginatedResult<FavoriteDto>>();
        result.Should().NotBeNull();
        result!.Items.Should().HaveCount(2);
        result.Metadata.TotalCount.Should().Be(3);
        result.Metadata.TotalPages.Should().Be(2);
    }

    [Fact]
    public async Task GetFavoriteIds_ReturnsListOfCookProfileIds()
    {
        // Arrange
        var eater = await AuthHelper.CreateUserAsync("eater@test.com", "EaterPass123!@#", "Eater");
        
        var cook1 = await AuthHelper.CreateUserAsync("cook1@test.com", "CookPass123!@#", "Cook");
        var profile1 = new CookProfileBuilder()
            .ForUser(cook1.Id)
            .WithKitchenName("Kitchen 1")
            .Build();
        DbContext.CookProfiles.Add(profile1);
        await DbContext.SaveChangesAsync();

        var cook2 = await AuthHelper.CreateUserAsync("cook2@test.com", "CookPass123!@#", "Cook");
        var profile2 = new CookProfileBuilder()
            .ForUser(cook2.Id)
            .WithKitchenName("Kitchen 2")
            .Build();
        DbContext.CookProfiles.Add(profile2);
        await DbContext.SaveChangesAsync();

        DbContext.Favorites.AddRange(
            new Favorite { EaterUserId = eater.Id, CookProfileId = profile1.Id },
            new Favorite { EaterUserId = eater.Id, CookProfileId = profile2.Id }
        );
        await DbContext.SaveChangesAsync();

        var eaterClient = await CreateAuthenticatedClient("eater@test.com", "EaterPass123!@#", "Eater");

        // Act
        var response = await eaterClient.GetAsync("/api/favorites/ids");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var ids = await response.Content.ReadFromJsonAsync<List<int>>();
        ids.Should().NotBeNull();
        ids.Should().HaveCount(2);
        ids.Should().Contain(profile1.Id);
        ids.Should().Contain(profile2.Id);
    }
}
