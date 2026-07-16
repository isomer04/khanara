using System.Net;
using System.Net.Http.Json;
using Khanara.API.DTOs;
using Khanara.API.Entities;
using Khanara.API.Tests.Builders;
using Khanara.API.Tests.Helpers;
using Khanara.API.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Khanara.API.Tests.Integration.Controllers;

public class CartControllerTests : BaseIntegrationTest
{
    public CartControllerTests(CustomWebApplicationFactory factory) : base(factory)
    {
    }

    private async Task<(AppUser cook, CookProfile profile, Dish dish)> CreateTestDish(
        string dishName = "Test Dish",
        decimal price = 15.99m,
        int portions = 10,
        bool isAvailable = true)
    {
        // Generate unique email to avoid duplicate user constraint violations
        var uniqueEmail = $"cook-{Guid.NewGuid()}@test.com";
        var cook = await AuthHelper.CreateUserAsync(uniqueEmail, "CookPass123!@#", "Cook");
        
        var profile = new CookProfileBuilder()
            .ForUser(cook.Id)
            .WithKitchenName("Test Kitchen")
            .Build();
        DbContext.CookProfiles.Add(profile);
        await DbContext.SaveChangesAsync();

        var dish = new DishBuilder()
            .WithName(dishName)
            .WithPrice(price)
            .WithPortions(portions)
            .ForCook(profile.Id)
            .Build();
        
        if (!isAvailable)
            dish.IsAvailable = false;

        DbContext.Dishes.Add(dish);
        await DbContext.SaveChangesAsync();

        return (cook, profile, dish);
    }

    [Fact]
    public async Task GetCart_EmptyCart_ReturnsEmptyList()
    {
        // Arrange
        var client = await CreateAuthenticatedClient("eater@test.com", "EaterPass123!@#", "Eater");

        // Act
        var response = await client.GetAsync("/api/cart");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var cart = await response.Content.ReadFromJsonAsync<List<CartItemDto>>();
        cart.Should().NotBeNull();
        cart.Should().BeEmpty();
    }

    [Fact]
    public async Task AddToCart_NewItem_AddsSuccessfully()
    {
        // Arrange
        var (_, _, dish) = await CreateTestDish();
        var client = await CreateAuthenticatedClient("eater@test.com", "EaterPass123!@#", "Eater");

        var addDto = new AddCartItemDto
        {
            DishId = dish.Id,
            Quantity = 2
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/cart", addDto);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var cartItem = await response.Content.ReadFromJsonAsync<CartItemDto>();
        cartItem.Should().NotBeNull();
        cartItem!.DishId.Should().Be(dish.Id);
        cartItem.DishName.Should().Be(dish.Name);
        cartItem.Price.Should().Be(dish.Price);
        cartItem.Quantity.Should().Be(2);

        // Verify in database
        DbContext.ChangeTracker.Clear();
        var dbItem = await DbContext.CartItems
            .FirstOrDefaultAsync(c => c.DishId == dish.Id);
        dbItem.Should().NotBeNull();
        dbItem!.Quantity.Should().Be(2);
    }

    [Fact]
    public async Task AddToCart_ExistingItem_IncrementsQuantity()
    {
        // Arrange
        var (_, _, dish) = await CreateTestDish();
        var user = await AuthHelper.CreateUserAsync("eater@test.com", "EaterPass123!@#", "Eater");
        
        // Add initial item
        var existingItem = new CartItem
        {
            UserId = user.Id,
            DishId = dish.Id,
            Quantity = 3
        };
        DbContext.CartItems.Add(existingItem);
        await DbContext.SaveChangesAsync();

        var client = await CreateAuthenticatedClient("eater@test.com", "EaterPass123!@#", "Eater");

        var addDto = new AddCartItemDto
        {
            DishId = dish.Id,
            Quantity = 2
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/cart", addDto);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var cartItem = await response.Content.ReadFromJsonAsync<CartItemDto>();
        cartItem.Should().NotBeNull();
        cartItem!.Quantity.Should().Be(5); // 3 + 2

        // Verify in database
        DbContext.ChangeTracker.Clear();
        var dbItem = await DbContext.CartItems
            .FirstOrDefaultAsync(c => c.DishId == dish.Id && c.UserId == user.Id);
        dbItem.Should().NotBeNull();
        dbItem!.Quantity.Should().Be(5);
    }

    [Fact]
    public async Task AddToCart_ExceedsMaxQuantity_ReturnsBadRequest()
    {
        // Arrange
        var (_, _, dish) = await CreateTestDish();
        var user = await AuthHelper.CreateUserAsync("eater@test.com", "EaterPass123!@#", "Eater");
        
        // Add item with 95 quantity
        var existingItem = new CartItem
        {
            UserId = user.Id,
            DishId = dish.Id,
            Quantity = 95
        };
        DbContext.CartItems.Add(existingItem);
        await DbContext.SaveChangesAsync();

        var client = await CreateAuthenticatedClient("eater@test.com", "EaterPass123!@#", "Eater");

        var addDto = new AddCartItemDto
        {
            DishId = dish.Id,
            Quantity = 10 // Would exceed 100
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/cart", addDto);

        // Assert
        await response.ShouldBeBadRequest();
        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("cannot exceed 100");

        // Verify quantity unchanged in database
        var dbItem = await DbContext.CartItems
            .FirstOrDefaultAsync(c => c.DishId == dish.Id && c.UserId == user.Id);
        dbItem!.Quantity.Should().Be(95);
    }

    [Fact]
    public async Task AddToCart_UnavailableDish_ReturnsBadRequest()
    {
        // Arrange
        var (_, _, dish) = await CreateTestDish(isAvailable: false);
        var client = await CreateAuthenticatedClient("eater@test.com", "EaterPass123!@#", "Eater");

        var addDto = new AddCartItemDto
        {
            DishId = dish.Id,
            Quantity = 1
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/cart", addDto);

        // Assert
        await response.ShouldBeBadRequest();
        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("not available");

        // Verify not added to database
        var dbItem = await DbContext.CartItems
            .FirstOrDefaultAsync(c => c.DishId == dish.Id);
        dbItem.Should().BeNull();
    }

    [Fact]
    public async Task AddToCart_NonExistentDish_ReturnsNotFound()
    {
        // Arrange
        var client = await CreateAuthenticatedClient("eater@test.com", "EaterPass123!@#", "Eater");

        var addDto = new AddCartItemDto
        {
            DishId = 99999,
            Quantity = 1
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/cart", addDto);

        // Assert
        response.ShouldBeNotFound();
    }

    [Fact]
    public async Task UpdateCartItem_ValidQuantity_UpdatesSuccessfully()
    {
        // Arrange
        var (_, _, dish) = await CreateTestDish();
        var user = await AuthHelper.CreateUserAsync("eater@test.com", "EaterPass123!@#", "Eater");
        
        var cartItem = new CartItem
        {
            UserId = user.Id,
            DishId = dish.Id,
            Quantity = 3
        };
        DbContext.CartItems.Add(cartItem);
        await DbContext.SaveChangesAsync();

        var client = await CreateAuthenticatedClient("eater@test.com", "EaterPass123!@#", "Eater");

        var updateDto = new UpdateCartItemDto
        {
            Quantity = 5
        };

        // Act
        var response = await client.PutAsJsonAsync($"/api/cart/{dish.Id}", updateDto);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var updated = await response.Content.ReadFromJsonAsync<CartItemDto>();
        updated.Should().NotBeNull();
        updated!.Quantity.Should().Be(5);

        // Verify in database
        DbContext.ChangeTracker.Clear();
        var dbItem = await DbContext.CartItems
            .FirstOrDefaultAsync(c => c.DishId == dish.Id && c.UserId == user.Id);
        dbItem!.Quantity.Should().Be(5);
    }

    [Fact]
    public async Task UpdateCartItem_NonExistentItem_ReturnsNotFound()
    {
        // Arrange
        var client = await CreateAuthenticatedClient("eater@test.com", "EaterPass123!@#", "Eater");

        var updateDto = new UpdateCartItemDto
        {
            Quantity = 5
        };

        // Act
        var response = await client.PutAsJsonAsync("/api/cart/99999", updateDto);

        // Assert
        response.ShouldBeNotFound();
    }

    [Fact]
    public async Task RemoveCartItem_ExistingItem_DeletesSuccessfully()
    {
        // Arrange
        var (_, _, dish) = await CreateTestDish();
        var user = await AuthHelper.CreateUserAsync("eater@test.com", "EaterPass123!@#", "Eater");
        
        var cartItem = new CartItem
        {
            UserId = user.Id,
            DishId = dish.Id,
            Quantity = 3
        };
        DbContext.CartItems.Add(cartItem);
        await DbContext.SaveChangesAsync();

        var client = await CreateAuthenticatedClient("eater@test.com", "EaterPass123!@#", "Eater");

        // Act
        var response = await client.DeleteAsync($"/api/cart/{dish.Id}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Verify removed from database
        DbContext.ChangeTracker.Clear();
        var dbItem = await DbContext.CartItems
            .FirstOrDefaultAsync(c => c.DishId == dish.Id && c.UserId == user.Id);
        dbItem.Should().BeNull();
    }

    [Fact]
    public async Task RemoveCartItem_NonExistentItem_ReturnsNotFound()
    {
        // Arrange
        var client = await CreateAuthenticatedClient("eater@test.com", "EaterPass123!@#", "Eater");

        // Act
        var response = await client.DeleteAsync("/api/cart/99999");

        // Assert
        response.ShouldBeNotFound();
    }

    [Fact]
    public async Task ClearCart_WithItems_RemovesAllItems()
    {
        // Arrange
        var (_, _, dish1) = await CreateTestDish("Dish 1");
        var (_, _, dish2) = await CreateTestDish("Dish 2", 20.99m);
        var user = await AuthHelper.CreateUserAsync("eater@test.com", "EaterPass123!@#", "Eater");
        
        DbContext.CartItems.AddRange(
            new CartItem { UserId = user.Id, DishId = dish1.Id, Quantity = 2 },
            new CartItem { UserId = user.Id, DishId = dish2.Id, Quantity = 3 }
        );
        await DbContext.SaveChangesAsync();

        var client = await CreateAuthenticatedClient("eater@test.com", "EaterPass123!@#", "Eater");

        // Act
        var response = await client.DeleteAsync("/api/cart");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Verify all items removed
        DbContext.ChangeTracker.Clear();
        var remainingItems = await DbContext.CartItems
            .Where(c => c.UserId == user.Id)
            .ToListAsync();
        remainingItems.Should().BeEmpty();
    }

    [Fact]
    public async Task ClearCart_EmptyCart_ReturnsNoContent()
    {
        // Arrange
        var client = await CreateAuthenticatedClient("eater@test.com", "EaterPass123!@#", "Eater");

        // Act
        var response = await client.DeleteAsync("/api/cart");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task MergeCart_GuestToAuthenticated_CombinesItems()
    {
        // Arrange
        var (_, _, dish1) = await CreateTestDish("Dish 1");
        var (_, _, dish2) = await CreateTestDish("Dish 2", 20.99m);
        var (_, _, dish3) = await CreateTestDish("Dish 3", 25.99m);
        
        var user = await AuthHelper.CreateUserAsync("eater@test.com", "EaterPass123!@#", "Eater");
        
        // User already has dish1 in cart
        DbContext.CartItems.Add(new CartItem
        {
            UserId = user.Id,
            DishId = dish1.Id,
            Quantity = 2
        });
        await DbContext.SaveChangesAsync();

        var client = await CreateAuthenticatedClient("eater@test.com", "EaterPass123!@#", "Eater");

        // Guest cart has dish1 (should merge), dish2 (new), and dish3 (new)
        var mergeDto = new MergeCartDto
        {
            Items =
            [
                new AddCartItemDto { DishId = dish1.Id, Quantity = 3 },
                new AddCartItemDto { DishId = dish2.Id, Quantity = 1 },
                new AddCartItemDto { DishId = dish3.Id, Quantity = 2 }
            ]
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/cart/merge", mergeDto);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var cart = await response.Content.ReadFromJsonAsync<List<CartItemDto>>();
        cart.Should().NotBeNull();
        cart.Should().HaveCount(3);

        // Verify dish1 quantity was merged (2 + 3 = 5)
        var dish1Item = cart!.First(c => c.DishId == dish1.Id);
        dish1Item.Quantity.Should().Be(5);

        // Verify dish2 and dish3 were added
        cart.Should().Contain(c => c.DishId == dish2.Id && c.Quantity == 1);
        cart.Should().Contain(c => c.DishId == dish3.Id && c.Quantity == 2);

        // Verify in database
        var dbItems = await DbContext.CartItems
            .Where(c => c.UserId == user.Id)
            .ToListAsync();
        dbItems.Should().HaveCount(3);
    }

    [Fact]
    public async Task MergeCart_DuplicateItems_AggregatesQuantities()
    {
        // Arrange
        var (_, _, dish) = await CreateTestDish();
        var client = await CreateAuthenticatedClient("eater@test.com", "EaterPass123!@#", "Eater");

        // Guest cart has same dish multiple times
        var mergeDto = new MergeCartDto
        {
            Items =
            [
                new AddCartItemDto { DishId = dish.Id, Quantity = 2 },
                new AddCartItemDto { DishId = dish.Id, Quantity = 3 },
                new AddCartItemDto { DishId = dish.Id, Quantity = 1 }
            ]
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/cart/merge", mergeDto);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var cart = await response.Content.ReadFromJsonAsync<List<CartItemDto>>();
        cart.Should().NotBeNull();
        cart.Should().HaveCount(1);
        cart![0].Quantity.Should().Be(6); // 2 + 3 + 1

        // Verify in database - should be single item
        var dbItems = await DbContext.CartItems
            .Where(c => c.DishId == dish.Id)
            .ToListAsync();
        dbItems.Should().HaveCount(1);
        dbItems[0].Quantity.Should().Be(6);
    }

    [Fact]
    public async Task MergeCart_UnavailableDish_SkipsItem()
    {
        // Arrange
        var (_, _, availableDish) = await CreateTestDish("Available Dish");
        var (_, _, unavailableDish) = await CreateTestDish("Unavailable Dish", isAvailable: false);
        
        var client = await CreateAuthenticatedClient("eater@test.com", "EaterPass123!@#", "Eater");

        var mergeDto = new MergeCartDto
        {
            Items =
            [
                new AddCartItemDto { DishId = availableDish.Id, Quantity = 2 },
                new AddCartItemDto { DishId = unavailableDish.Id, Quantity = 3 }
            ]
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/cart/merge", mergeDto);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var cart = await response.Content.ReadFromJsonAsync<List<CartItemDto>>();
        cart.Should().NotBeNull();
        cart.Should().HaveCount(1);
        cart![0].DishId.Should().Be(availableDish.Id);

        // Verify unavailable dish not in database
        var dbItems = await DbContext.CartItems.ToListAsync();
        dbItems.Should().NotContain(c => c.DishId == unavailableDish.Id);
    }

    [Fact]
    public async Task MergeCart_ExceedsMaxQuantity_SkipsItem()
    {
        // Arrange
        var (_, _, dish) = await CreateTestDish();
        var user = await AuthHelper.CreateUserAsync("eater@test.com", "EaterPass123!@#", "Eater");
        
        // User already has 95 of this dish
        DbContext.CartItems.Add(new CartItem
        {
            UserId = user.Id,
            DishId = dish.Id,
            Quantity = 95
        });
        await DbContext.SaveChangesAsync();

        var client = await CreateAuthenticatedClient("eater@test.com", "EaterPass123!@#", "Eater");

        // Try to merge 10 more (would exceed 100)
        var mergeDto = new MergeCartDto
        {
            Items =
            [
                new AddCartItemDto { DishId = dish.Id, Quantity = 10 }
            ]
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/cart/merge", mergeDto);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        
        // Verify quantity unchanged
        var dbItem = await DbContext.CartItems
            .FirstOrDefaultAsync(c => c.DishId == dish.Id && c.UserId == user.Id);
        dbItem!.Quantity.Should().Be(95);
    }

    [Fact]
    public async Task GetCart_WithMultipleItems_ReturnsAllItems()
    {
        // Arrange
        var (_, _, dish1) = await CreateTestDish("Dish 1", 15.99m);
        var (_, _, dish2) = await CreateTestDish("Dish 2", 20.99m);
        var (_, _, dish3) = await CreateTestDish("Dish 3", 25.99m);
        
        var user = await AuthHelper.CreateUserAsync("eater@test.com", "EaterPass123!@#", "Eater");
        
        DbContext.CartItems.AddRange(
            new CartItem { UserId = user.Id, DishId = dish1.Id, Quantity = 2 },
            new CartItem { UserId = user.Id, DishId = dish2.Id, Quantity = 1 },
            new CartItem { UserId = user.Id, DishId = dish3.Id, Quantity = 3 }
        );
        await DbContext.SaveChangesAsync();

        var client = await CreateAuthenticatedClient("eater@test.com", "EaterPass123!@#", "Eater");

        // Act
        var response = await client.GetAsync("/api/cart");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var cart = await response.Content.ReadFromJsonAsync<List<CartItemDto>>();
        cart.Should().NotBeNull();
        cart.Should().HaveCount(3);
        
        cart.Should().Contain(c => c.DishId == dish1.Id && c.Quantity == 2 && c.Price == 15.99m);
        cart.Should().Contain(c => c.DishId == dish2.Id && c.Quantity == 1 && c.Price == 20.99m);
        cart.Should().Contain(c => c.DishId == dish3.Id && c.Quantity == 3 && c.Price == 25.99m);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(int.MaxValue)]
    [InlineData(101)]  // Over max limit
    public async Task AddToCart_InvalidQuantity_ReturnsBadRequest(int invalidQuantity)
    {
        // Arrange
        var (_, _, dish) = await CreateTestDish();
        var client = await CreateAuthenticatedClient("eater@test.com", "EaterPass123!@#", "Eater");

        var addDto = new AddCartItemDto
        {
            DishId = dish.Id,
            Quantity = invalidQuantity
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/cart", addDto);

        // Assert
        await response.ShouldBeBadRequest();
    }

    [Fact]
    public async Task GetCart_WithoutAuthentication_ReturnsUnauthorized()
    {
        // Arrange
        var unauthenticatedClient = Factory.CreateClient();

        // Act
        var response = await unauthenticatedClient.GetAsync("/api/cart");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}
