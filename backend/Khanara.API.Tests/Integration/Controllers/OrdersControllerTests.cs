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

public class OrdersControllerTests : BaseIntegrationTest
{
    public OrdersControllerTests(CustomWebApplicationFactory factory) : base(factory)
    {
    }

    private async Task<(AppUser eater, AppUser cook, CookProfile profile, Dish dish)> CreateOrderScenario(
        int dishPortions = 10,
        decimal dishPrice = 15.99m,
        bool isAcceptingOrders = true)
    {
        var eater = await AuthHelper.CreateUserAsync("eater@test.com", "EaterPass123!@#", "Eater");
        var cook = await AuthHelper.CreateUserAsync("cook@test.com", "CookPass123!@#", "Cook");

        var profile = new CookProfileBuilder()
            .ForUser(cook.Id)
            .WithKitchenName("Test Kitchen")
            .Build();
        profile.IsAcceptingOrders = isAcceptingOrders;
        DbContext.CookProfiles.Add(profile);
        await DbContext.SaveChangesAsync();

        var dish = new DishBuilder()
            .WithName("Test Dish")
            .WithPrice(dishPrice)
            .WithPortions(dishPortions)
            .ForCook(profile.Id)
            .Build();
        DbContext.Dishes.Add(dish);
        await DbContext.SaveChangesAsync();

        return (eater, cook, profile, dish);
    }

    [Fact]
    public async Task PlaceOrder_ValidOrder_CreatesOrderInDatabase()
    {
        // Arrange
        var (eater, cook, profile, dish) = await CreateOrderScenario();
        var client = await CreateAuthenticatedClient("eater@test.com", "EaterPass123!@#", "Eater");

        var createDto = new CreateOrderDto
        {
            CookProfileId = profile.Id,
            FulfillmentType = FulfillmentType.Pickup,
            PaymentMethod = PaymentMethod.Cash,
            Items =
            [
                new CreateOrderItemDto { DishId = dish.Id, Quantity = 2 }
            ]
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/orders", createDto);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var orderDto = await response.Content.ReadFromJsonAsync<OrderDto>();
        orderDto.Should().NotBeNull();
        orderDto!.EaterUserId.Should().Be(eater.Id);
        orderDto.CookProfileId.Should().Be(profile.Id);
        orderDto.Status.Should().Be(OrderStatus.Pending);
        orderDto.PaymentStatus.Should().Be(PaymentStatus.Pending);
        orderDto.TotalAmount.Should().Be(2 * dish.Price);
        orderDto.Items.Should().HaveCount(1);
        orderDto.Items[0].DishId.Should().Be(dish.Id);
        orderDto.Items[0].Quantity.Should().Be(2);
        orderDto.Items[0].UnitPriceSnapshot.Should().Be(dish.Price);

        // Verify in database
        var dbOrder = await DbContext.Orders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == orderDto.Id);
        dbOrder.Should().NotBeNull();
        dbOrder!.Items.Should().HaveCount(1);
    }

    [Fact]
    public async Task PlaceOrder_ValidOrder_DecrementsPortions()
    {
        // Arrange
        var (eater, cook, profile, dish) = await CreateOrderScenario(dishPortions: 10);
        var client = await CreateAuthenticatedClient("eater@test.com", "EaterPass123!@#", "Eater");

        var createDto = new CreateOrderDto
        {
            CookProfileId = profile.Id,
            FulfillmentType = FulfillmentType.Pickup,
            PaymentMethod = PaymentMethod.Cash,
            Items =
            [
                new CreateOrderItemDto { DishId = dish.Id, Quantity = 3 }
            ]
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/orders", createDto);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);

        // Verify portions decremented
        DbContext.ChangeTracker.Clear();
        var updatedDish = await DbContext.Dishes.FindAsync(dish.Id);
        updatedDish.Should().NotBeNull();
        updatedDish!.PortionsRemainingToday.Should().Be(7); // 10 - 3
    }

    [Fact]
    public async Task PlaceOrder_UnavailableDish_ReturnsBadRequest()
    {
        // Arrange
        var (eater, cook, profile, dish) = await CreateOrderScenario();
        dish.IsAvailable = false;
        await DbContext.SaveChangesAsync();

        var client = await CreateAuthenticatedClient("eater@test.com", "EaterPass123!@#", "Eater");

        var createDto = new CreateOrderDto
        {
            CookProfileId = profile.Id,
            FulfillmentType = FulfillmentType.Pickup,
            PaymentMethod = PaymentMethod.Cash,
            Items =
            [
                new CreateOrderItemDto { DishId = dish.Id, Quantity = 1 }
            ]
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/orders", createDto);

        // Assert
        await response.ShouldBeBadRequest();
        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("not available");
    }

    [Fact]
    public async Task PlaceOrder_InsufficientPortions_ReturnsBadRequest()
    {
        // Arrange
        var (eater, cook, profile, dish) = await CreateOrderScenario(dishPortions: 5);
        var client = await CreateAuthenticatedClient("eater@test.com", "EaterPass123!@#", "Eater");

        var createDto = new CreateOrderDto
        {
            CookProfileId = profile.Id,
            FulfillmentType = FulfillmentType.Pickup,
            PaymentMethod = PaymentMethod.Cash,
            Items =
            [
                new CreateOrderItemDto { DishId = dish.Id, Quantity = 10 } // More than available
            ]
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/orders", createDto);

        // Assert
        await response.ShouldBeBadRequest();
        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("Not enough portions");
        content.Should().Contain("Only 5 left");
    }

    [Fact]
    public async Task PlaceOrder_CookNotAcceptingOrders_ReturnsBadRequest()
    {
        // Arrange
        var (eater, cook, profile, dish) = await CreateOrderScenario(isAcceptingOrders: false);
        var client = await CreateAuthenticatedClient("eater@test.com", "EaterPass123!@#", "Eater");

        var createDto = new CreateOrderDto
        {
            CookProfileId = profile.Id,
            FulfillmentType = FulfillmentType.Pickup,
            PaymentMethod = PaymentMethod.Cash,
            Items =
            [
                new CreateOrderItemDto { DishId = dish.Id, Quantity = 1 }
            ]
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/orders", createDto);

        // Assert
        await response.ShouldBeBadRequest();
        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("not accepting orders");
    }

    [Fact]
    public async Task PlaceOrder_EmptyItems_ReturnsBadRequest()
    {
        // Arrange
        var (eater, cook, profile, dish) = await CreateOrderScenario();
        var client = await CreateAuthenticatedClient("eater@test.com", "EaterPass123!@#", "Eater");

        var createDto = new CreateOrderDto
        {
            CookProfileId = profile.Id,
            FulfillmentType = FulfillmentType.Pickup,
            PaymentMethod = PaymentMethod.Cash,
            Items = [] // Empty
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/orders", createDto);

        // Assert
        await response.ShouldBeBadRequest();
    }

    [Fact]
    public async Task PlaceOrder_DishFromDifferentCook_ReturnsBadRequest()
    {
        // Arrange
        var (eater, cook, profile, dish) = await CreateOrderScenario();
        
        // Create another cook with a dish
        var cook2 = await AuthHelper.CreateUserAsync("cook2@test.com", "CookPass123!@#", "Cook");
        var profile2 = new CookProfileBuilder()
            .ForUser(cook2.Id)
            .WithKitchenName("Other Kitchen")
            .Build();
        DbContext.CookProfiles.Add(profile2);
        await DbContext.SaveChangesAsync();

        var dish2 = new DishBuilder()
            .WithName("Other Dish")
            .ForCook(profile2.Id)
            .Build();
        DbContext.Dishes.Add(dish2);
        await DbContext.SaveChangesAsync();

        var client = await CreateAuthenticatedClient("eater@test.com", "EaterPass123!@#", "Eater");

        // Try to order from profile1 but include dish from profile2
        var createDto = new CreateOrderDto
        {
            CookProfileId = profile.Id,
            FulfillmentType = FulfillmentType.Pickup,
            PaymentMethod = PaymentMethod.Cash,
            Items =
            [
                new CreateOrderItemDto { DishId = dish2.Id, Quantity = 1 }
            ]
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/orders", createDto);

        // Assert
        await response.ShouldBeBadRequest();
        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("does not belong to the specified cook");
    }

    [Fact]
    public async Task UpdateOrderStatus_ValidTransition_UpdatesSuccessfully()
    {
        // Arrange
        var (eater, cook, profile, dish) = await CreateOrderScenario();
        
        var order = new OrderBuilder()
            .ForEater(eater.Id)
            .ForCook(profile.Id)
            .WithStatus(OrderStatus.Pending)
            .WithPaymentMethod(PaymentMethod.Cash)
            .WithItem(dish.Id, 2, dish.Price)
            .Build();
        DbContext.Orders.Add(order);
        await DbContext.SaveChangesAsync();

        var cookClient = await CreateAuthenticatedClient("cook@test.com", "CookPass123!@#", "Cook");

        var updateDto = new UpdateOrderStatusDto
        {
            NewStatus = OrderStatus.Accepted
        };

        // Act
        var response = await cookClient.PutAsJsonAsync($"/api/orders/{order.Id}/status", updateDto);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var orderDto = await response.Content.ReadFromJsonAsync<OrderDto>();
        orderDto.Should().NotBeNull();
        orderDto!.Status.Should().Be(OrderStatus.Accepted);

        // Verify in database
        DbContext.ChangeTracker.Clear();
        var dbOrder = await DbContext.Orders.FindAsync(order.Id);
        dbOrder!.Status.Should().Be(OrderStatus.Accepted);
    }

    [Fact]
    public async Task UpdateOrderStatus_InvalidTransition_ReturnsBadRequest()
    {
        // Arrange
        var (eater, cook, profile, dish) = await CreateOrderScenario();
        
        var order = new OrderBuilder()
            .ForEater(eater.Id)
            .ForCook(profile.Id)
            .WithStatus(OrderStatus.Pending)
            .WithItem(dish.Id, 2, dish.Price)
            .Build();
        DbContext.Orders.Add(order);
        await DbContext.SaveChangesAsync();

        var cookClient = await CreateAuthenticatedClient("cook@test.com", "CookPass123!@#", "Cook");

        // Try to jump from Pending to Delivered (invalid)
        var updateDto = new UpdateOrderStatusDto
        {
            NewStatus = OrderStatus.Delivered
        };

        // Act
        var response = await cookClient.PutAsJsonAsync($"/api/orders/{order.Id}/status", updateDto);

        // Assert
        await response.ShouldBeBadRequest();
        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("Cannot transition");
    }

    [Fact]
    public async Task UpdateOrderStatus_AsUnauthorizedUser_ReturnsForbidden()
    {
        // Arrange
        var (eater, cook, profile, dish) = await CreateOrderScenario();
        
        var order = new OrderBuilder()
            .ForEater(eater.Id)
            .ForCook(profile.Id)
            .WithStatus(OrderStatus.Pending)
            .WithItem(dish.Id, 2, dish.Price)
            .Build();
        DbContext.Orders.Add(order);
        await DbContext.SaveChangesAsync();

        // Create a different cook
        var otherCook = await AuthHelper.CreateUserAsync("othercook@test.com", "CookPass123!@#", "Cook");
        var otherClient = await CreateAuthenticatedClient("othercook@test.com", "CookPass123!@#", "Cook");

        var updateDto = new UpdateOrderStatusDto
        {
            NewStatus = OrderStatus.Accepted
        };

        // Act
        var response = await otherClient.PutAsJsonAsync($"/api/orders/{order.Id}/status", updateDto);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task CancelOrder_PendingOrderByEater_CancelsAndRestoresPortions()
    {
        // Arrange
        var (eater, cook, profile, dish) = await CreateOrderScenario(dishPortions: 10);
        
        var order = new OrderBuilder()
            .ForEater(eater.Id)
            .ForCook(profile.Id)
            .WithStatus(OrderStatus.Pending)
            .WithItem(dish.Id, 3, dish.Price)
            .Build();
        DbContext.Orders.Add(order);
        
        // Simulate portions being decremented when order was placed
        dish.PortionsRemainingToday = 7; // 10 - 3
        await DbContext.SaveChangesAsync();

        var eaterClient = await CreateAuthenticatedClient("eater@test.com", "EaterPass123!@#", "Eater");

        var cancelDto = new CancelOrderDto
        {
            Reason = "Changed my mind"
        };

        // Act
        var response = await eaterClient.PutAsJsonAsync($"/api/orders/{order.Id}/cancel", cancelDto);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var orderDto = await response.Content.ReadFromJsonAsync<OrderDto>();
        orderDto.Should().NotBeNull();
        orderDto!.Status.Should().Be(OrderStatus.Cancelled);
        orderDto.CancellationReason.Should().Be("Changed my mind");

        // Verify portions restored
        DbContext.ChangeTracker.Clear();
        var updatedDish = await DbContext.Dishes.FindAsync(dish.Id);
        updatedDish!.PortionsRemainingToday.Should().Be(10); // 7 + 3 restored
    }

    [Fact]
    public async Task CancelOrder_AcceptedOrderByCook_CancelsAndRestoresPortions()
    {
        // Arrange
        var (eater, cook, profile, dish) = await CreateOrderScenario(dishPortions: 10);
        
        var order = new OrderBuilder()
            .ForEater(eater.Id)
            .ForCook(profile.Id)
            .WithStatus(OrderStatus.Accepted)
            .WithItem(dish.Id, 2, dish.Price)
            .Build();
        DbContext.Orders.Add(order);
        
        dish.PortionsRemainingToday = 8; // 10 - 2
        await DbContext.SaveChangesAsync();

        var cookClient = await CreateAuthenticatedClient("cook@test.com", "CookPass123!@#", "Cook");

        var cancelDto = new CancelOrderDto
        {
            Reason = "Ran out of ingredients"
        };

        // Act
        var response = await cookClient.PutAsJsonAsync($"/api/orders/{order.Id}/cancel", cancelDto);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        
        // Verify portions restored
        DbContext.ChangeTracker.Clear();
        var updatedDish = await DbContext.Dishes.FindAsync(dish.Id);
        updatedDish!.PortionsRemainingToday.Should().Be(10); // 8 + 2 restored
    }

    [Fact]
    public async Task CancelOrder_NonPendingOrderByEater_ReturnsBadRequest()
    {
        // Arrange
        var (eater, cook, profile, dish) = await CreateOrderScenario();
        
        var order = new OrderBuilder()
            .ForEater(eater.Id)
            .ForCook(profile.Id)
            .WithStatus(OrderStatus.Accepted) // Not pending
            .WithItem(dish.Id, 2, dish.Price)
            .Build();
        DbContext.Orders.Add(order);
        await DbContext.SaveChangesAsync();

        var eaterClient = await CreateAuthenticatedClient("eater@test.com", "EaterPass123!@#", "Eater");

        var cancelDto = new CancelOrderDto
        {
            Reason = "Changed my mind"
        };

        // Act
        var response = await eaterClient.PutAsJsonAsync($"/api/orders/{order.Id}/cancel", cancelDto);

        // Assert
        await response.ShouldBeBadRequest();
        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("only cancel an order while it is still pending");
    }

    [Fact]
    public async Task CancelOrder_AnotherUsersOrder_ReturnsForbidden()
    {
        // Arrange
        var (eater, cook, profile, dish) = await CreateOrderScenario();
        
        var order = new OrderBuilder()
            .ForEater(eater.Id)
            .ForCook(profile.Id)
            .WithStatus(OrderStatus.Pending)
            .WithItem(dish.Id, 2, dish.Price)
            .Build();
        DbContext.Orders.Add(order);
        await DbContext.SaveChangesAsync();

        // Create a different eater
        var otherEater = await AuthHelper.CreateUserAsync("othereater@test.com", "EaterPass123!@#", "Eater");
        var otherClient = await CreateAuthenticatedClient("othereater@test.com", "EaterPass123!@#", "Eater");

        var cancelDto = new CancelOrderDto
        {
            Reason = "Not my order"
        };

        // Act
        var response = await otherClient.PutAsJsonAsync($"/api/orders/{order.Id}/cancel", cancelDto);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task GetOrders_AsEater_ReturnsOnlyUserOrders()
    {
        // Arrange
        var (eater, cook, profile, dish) = await CreateOrderScenario();
        
        // Create orders for this eater
        var order1 = new OrderBuilder()
            .ForEater(eater.Id)
            .ForCook(profile.Id)
            .WithItem(dish.Id, 1, dish.Price)
            .Build();
        var order2 = new OrderBuilder()
            .ForEater(eater.Id)
            .ForCook(profile.Id)
            .WithItem(dish.Id, 2, dish.Price)
            .Build();
        
        // Create order for another eater
        var otherEater = await AuthHelper.CreateUserAsync("othereater@test.com", "EaterPass123!@#", "Eater");
        var order3 = new OrderBuilder()
            .ForEater(otherEater.Id)
            .ForCook(profile.Id)
            .WithItem(dish.Id, 1, dish.Price)
            .Build();

        DbContext.Orders.AddRange(order1, order2, order3);
        await DbContext.SaveChangesAsync();

        var eaterClient = await CreateAuthenticatedClient("eater@test.com", "EaterPass123!@#", "Eater");

        // Act
        var response = await eaterClient.GetAsync("/api/orders/eater");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PaginatedResult<OrderDto>>();
        result.Should().NotBeNull();
        result!.Items.Should().HaveCount(2);
        result.Items.Should().AllSatisfy(o => o.EaterUserId.Should().Be(eater.Id));
    }

    [Fact]
    public async Task GetOrders_AsCook_ReturnsOnlyKitchenOrders()
    {
        // Arrange
        var (eater, cook, profile, dish) = await CreateOrderScenario();
        
        // Create another cook with profile
        var cook2 = await AuthHelper.CreateUserAsync("cook2@test.com", "CookPass123!@#", "Cook");
        var profile2 = new CookProfileBuilder()
            .ForUser(cook2.Id)
            .WithKitchenName("Other Kitchen")
            .Build();
        DbContext.CookProfiles.Add(profile2);
        await DbContext.SaveChangesAsync();

        // Create orders for first cook
        var order1 = new OrderBuilder()
            .ForEater(eater.Id)
            .ForCook(profile.Id)
            .WithItem(dish.Id, 1, dish.Price)
            .Build();
        var order2 = new OrderBuilder()
            .ForEater(eater.Id)
            .ForCook(profile.Id)
            .WithItem(dish.Id, 2, dish.Price)
            .Build();
        
        // Create order for second cook
        var dish2 = new DishBuilder()
            .WithName("Other Dish")
            .ForCook(profile2.Id)
            .Build();
        DbContext.Dishes.Add(dish2);
        await DbContext.SaveChangesAsync();

        var order3 = new OrderBuilder()
            .ForEater(eater.Id)
            .ForCook(profile2.Id)
            .WithItem(dish2.Id, 1, dish2.Price)
            .Build();

        DbContext.Orders.AddRange(order1, order2, order3);
        await DbContext.SaveChangesAsync();

        var cookClient = await CreateAuthenticatedClient("cook@test.com", "CookPass123!@#", "Cook");

        // Act
        var response = await cookClient.GetAsync("/api/orders/cook");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PaginatedResult<OrderDto>>();
        result.Should().NotBeNull();
        result!.Items.Should().HaveCount(2);
        result.Items.Should().AllSatisfy(o => o.CookProfileId.Should().Be(profile.Id));
    }

    [Fact]
    public async Task GetOrders_WithPagination_ReturnsCorrectPage()
    {
        // Arrange
        var (eater, cook, profile, dish) = await CreateOrderScenario();
        
        // Create 15 orders
        for (int i = 0; i < 15; i++)
        {
            var order = new OrderBuilder()
                .ForEater(eater.Id)
                .ForCook(profile.Id)
                .WithItem(dish.Id, 1, dish.Price)
                .Build();
            DbContext.Orders.Add(order);
        }
        await DbContext.SaveChangesAsync();

        var eaterClient = await CreateAuthenticatedClient("eater@test.com", "EaterPass123!@#", "Eater");

        // Act - Get page 2 with page size 10
        var response = await eaterClient.GetAsync("/api/orders/eater?pageNumber=2&pageSize=10");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PaginatedResult<OrderDto>>();
        result.Should().NotBeNull();
        result!.Items.Should().HaveCount(5); // 15 total, page 2 has 5
        result.Metadata.CurrentPage.Should().Be(2);
        result.Metadata.TotalPages.Should().Be(2);
        result.Metadata.TotalCount.Should().Be(15);
    }

    [Fact]
    public async Task GetOrder_AsEater_ReturnsOrder()
    {
        // Arrange
        var (eater, cook, profile, dish) = await CreateOrderScenario();
        
        var order = new OrderBuilder()
            .ForEater(eater.Id)
            .ForCook(profile.Id)
            .WithItem(dish.Id, 2, dish.Price)
            .Build();
        DbContext.Orders.Add(order);
        await DbContext.SaveChangesAsync();

        var eaterClient = await CreateAuthenticatedClient("eater@test.com", "EaterPass123!@#", "Eater");

        // Act
        var response = await eaterClient.GetAsync($"/api/orders/{order.Id}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var orderDto = await response.Content.ReadFromJsonAsync<OrderDto>();
        orderDto.Should().NotBeNull();
        orderDto!.Id.Should().Be(order.Id);
        orderDto.EaterUserId.Should().Be(eater.Id);
    }

    [Fact]
    public async Task GetOrder_AsCook_ReturnsOrder()
    {
        // Arrange
        var (eater, cook, profile, dish) = await CreateOrderScenario();
        
        var order = new OrderBuilder()
            .ForEater(eater.Id)
            .ForCook(profile.Id)
            .WithItem(dish.Id, 2, dish.Price)
            .Build();
        DbContext.Orders.Add(order);
        await DbContext.SaveChangesAsync();

        var cookClient = await CreateAuthenticatedClient("cook@test.com", "CookPass123!@#", "Cook");

        // Act
        var response = await cookClient.GetAsync($"/api/orders/{order.Id}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var orderDto = await response.Content.ReadFromJsonAsync<OrderDto>();
        orderDto.Should().NotBeNull();
        orderDto!.Id.Should().Be(order.Id);
        orderDto.CookProfileId.Should().Be(profile.Id);
    }

    [Fact]
    public async Task GetOrder_AsUnauthorizedUser_ReturnsForbidden()
    {
        // Arrange
        var (eater, cook, profile, dish) = await CreateOrderScenario();
        
        var order = new OrderBuilder()
            .ForEater(eater.Id)
            .ForCook(profile.Id)
            .WithItem(dish.Id, 2, dish.Price)
            .Build();
        DbContext.Orders.Add(order);
        await DbContext.SaveChangesAsync();

        // Create a different eater
        var otherEater = await AuthHelper.CreateUserAsync("othereater@test.com", "EaterPass123!@#", "Eater");
        var otherClient = await CreateAuthenticatedClient("othereater@test.com", "EaterPass123!@#", "Eater");

        // Act
        var response = await otherClient.GetAsync($"/api/orders/{order.Id}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task UpdateOrderStatus_WithoutAuthentication_ReturnsUnauthorized()
    {
        // Arrange
        var (eater, cook, profile, dish) = await CreateOrderScenario();
        
        var order = new OrderBuilder()
            .ForEater(eater.Id)
            .ForCook(profile.Id)
            .WithStatus(OrderStatus.Pending)
            .WithItem(dish.Id, 2, dish.Price)
            .Build();
        DbContext.Orders.Add(order);
        await DbContext.SaveChangesAsync();

        var unauthenticatedClient = Factory.CreateClient();  // No auth header

        var updateDto = new UpdateOrderStatusDto
        {
            NewStatus = OrderStatus.Accepted
        };

        // Act
        var response = await unauthenticatedClient.PutAsJsonAsync($"/api/orders/{order.Id}/status", updateDto);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task PlaceOrder_WithoutAuthentication_ReturnsUnauthorized()
    {
        // Arrange
        var (eater, cook, profile, dish) = await CreateOrderScenario();
        var unauthenticatedClient = Factory.CreateClient();

        var createDto = new CreateOrderDto
        {
            CookProfileId = profile.Id,
            FulfillmentType = FulfillmentType.Pickup,
            PaymentMethod = PaymentMethod.Cash,
            Items = [new CreateOrderItemDto { DishId = dish.Id, Quantity = 1 }]
        };

        // Act
        var response = await unauthenticatedClient.PostAsJsonAsync("/api/orders", createDto);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task PlaceOrder_MultipleItems_CalculatesTotalCorrectly()
    {
        // Arrange
        var (eater, cook, profile, dish1) = await CreateOrderScenario(dishPrice: 15.99m);
        
        var dish2 = new DishBuilder()
            .WithName("Dish 2")
            .WithPrice(20.50m)
            .WithPortions(10)
            .ForCook(profile.Id)
            .Build();
        DbContext.Dishes.Add(dish2);
        await DbContext.SaveChangesAsync();

        var client = await CreateAuthenticatedClient("eater@test.com", "EaterPass123!@#", "Eater");

        var createDto = new CreateOrderDto
        {
            CookProfileId = profile.Id,
            FulfillmentType = FulfillmentType.Delivery,
            PaymentMethod = PaymentMethod.Cash,
            Items =
            [
                new CreateOrderItemDto { DishId = dish1.Id, Quantity = 2 },
                new CreateOrderItemDto { DishId = dish2.Id, Quantity = 3 }
            ]
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/orders", createDto);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var orderDto = await response.Content.ReadFromJsonAsync<OrderDto>();
        orderDto.Should().NotBeNull();
        orderDto!.TotalAmount.Should().Be((2 * 15.99m) + (3 * 20.50m)); // 31.98 + 61.50 = 93.48
        orderDto.Items.Should().HaveCount(2);
    }

    [Fact(Skip = "SQLite in-memory does not support true concurrent writes; this test is only reliable against a real database with row-level locking.")]
    public async Task PlaceOrder_ConcurrentOrders_PreventsOverselling()
    {
        // Arrange - Create two eaters and one dish with limited portions
        var eater1 = await AuthHelper.CreateUserAsync("eater1@test.com", "EaterPass123!@#", "Eater");
        var eater2 = await AuthHelper.CreateUserAsync("eater2@test.com", "EaterPass123!@#", "Eater");
        var cook = await AuthHelper.CreateUserAsync("cook@test.com", "CookPass123!@#", "Cook");

        var profile = new CookProfileBuilder()
            .ForUser(cook.Id)
            .WithKitchenName("Test Kitchen")
            .Build();
        DbContext.CookProfiles.Add(profile);
        await DbContext.SaveChangesAsync();

        var dish = new DishBuilder()
            .WithName("Limited Dish")
            .WithPrice(15.99m)
            .WithPortions(10, 10)  // Only 10 portions available
            .ForCook(profile.Id)
            .Build();
        DbContext.Dishes.Add(dish);
        await DbContext.SaveChangesAsync();

        var client1 = await CreateAuthenticatedClient("eater1@test.com", "EaterPass123!@#", "Eater");
        var client2 = await CreateAuthenticatedClient("eater2@test.com", "EaterPass123!@#", "Eater");

        var order1 = new CreateOrderDto
        {
            CookProfileId = profile.Id,
            FulfillmentType = FulfillmentType.Pickup,
            PaymentMethod = PaymentMethod.Cash,
            Items = [new CreateOrderItemDto { DishId = dish.Id, Quantity = 10 }]
        };

        var order2 = new CreateOrderDto
        {
            CookProfileId = profile.Id,
            FulfillmentType = FulfillmentType.Pickup,
            PaymentMethod = PaymentMethod.Cash,
            Items = [new CreateOrderItemDto { DishId = dish.Id, Quantity = 10 }]
        };

        // Act - Execute both orders concurrently
        var tasks = new[]
        {
            client1.PostAsJsonAsync("/api/orders", order1),
            client2.PostAsJsonAsync("/api/orders", order2)
        };

        var responses = await Task.WhenAll(tasks);

        // Assert - Only ONE order should succeed due to concurrency control
        var successCount = responses.Count(r => r.IsSuccessStatusCode);
        successCount.Should().Be(1, "Only one order should succeed when portions are limited");

        var failedCount = responses.Count(r => r.StatusCode == HttpStatusCode.BadRequest);
        failedCount.Should().Be(1, "One order should fail due to insufficient portions");

        // Verify portions are correct in database
        var updatedDish = await DbContext.Dishes.FindAsync(dish.Id);
        updatedDish.Should().NotBeNull();
        updatedDish!.PortionsRemainingToday.Should().Be(0, "All portions should be allocated to the successful order");
    }

    [Fact]
    public async Task PlaceOrder_PriceFromDatabase_IgnoresClientInput()
    {
        // Arrange
        var (eater, cook, profile, dish) = await CreateOrderScenario(dishPrice: 50.00m);
        var client = await CreateAuthenticatedClient("eater@test.com", "EaterPass123!@#", "Eater");

        var createDto = new CreateOrderDto
        {
            CookProfileId = profile.Id,
            FulfillmentType = FulfillmentType.Pickup,
            PaymentMethod = PaymentMethod.Cash,
            Items = [new CreateOrderItemDto { DishId = dish.Id, Quantity = 2 }]
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/orders", createDto);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var orderDto = await response.Content.ReadFromJsonAsync<OrderDto>();
        orderDto.Should().NotBeNull();
        
        // CRITICAL: Price MUST come from database, not client
        orderDto!.TotalAmount.Should().Be(100.00m, "Price must be from database");
        orderDto.Items.ElementAt(0).UnitPriceSnapshot.Should().Be(50.00m, "Unit price must match database");

        // Verify in database
        var dbOrder = await DbContext.Orders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == orderDto.Id);
        dbOrder.Should().NotBeNull();
        dbOrder!.Items.ElementAt(0).UnitPriceSnapshot.Should().Be(50.00m);
        dbOrder.TotalAmount.Should().Be(100.00m);
    }

    [Fact]
    public async Task PlaceOrder_PriceChangedDuringCheckout_UsesCurrentPrice()
    {
        // Arrange
        var (eater, cook, profile, dish) = await CreateOrderScenario(dishPrice: 50.00m);

        // Simulate price change between viewing and ordering
        dish.Price = 60.00m;
        await DbContext.SaveChangesAsync();

        var client = await CreateAuthenticatedClient("eater@test.com", "EaterPass123!@#", "Eater");

        var createDto = new CreateOrderDto
        {
            CookProfileId = profile.Id,
            FulfillmentType = FulfillmentType.Pickup,
            PaymentMethod = PaymentMethod.Cash,
            Items = [new CreateOrderItemDto { DishId = dish.Id, Quantity = 1 }]
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/orders", createDto);

        // Assert
        var orderDto = await response.Content.ReadFromJsonAsync<OrderDto>();
        orderDto.Should().NotBeNull();
        
        // Should use NEW price (60.00), not old price (50.00)
        orderDto!.TotalAmount.Should().Be(60.00m, "Should use current database price");
        orderDto.Items[0].UnitPriceSnapshot.Should().Be(60.00m);
    }

    [Theory]
    [InlineData(int.MaxValue)]
    [InlineData(-1)]
    [InlineData(0)]
    public async Task PlaceOrder_InvalidQuantity_ReturnsBadRequest(int invalidQuantity)
    {
        // Arrange
        var (eater, cook, profile, dish) = await CreateOrderScenario();
        var client = await CreateAuthenticatedClient("eater@test.com", "EaterPass123!@#", "Eater");

        var createDto = new CreateOrderDto
        {
            CookProfileId = profile.Id,
            FulfillmentType = FulfillmentType.Pickup,
            PaymentMethod = PaymentMethod.Cash,
            Items = [new CreateOrderItemDto { DishId = dish.Id, Quantity = invalidQuantity }]
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/orders", createDto);

        // Assert
        await response.ShouldBeBadRequest();
    }
}
