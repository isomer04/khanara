using System.Net;
using System.Net.Http.Json;
using Khanara.API.DTOs;
using Khanara.API.Entities;
using Khanara.API.Helpers;
using Khanara.API.Tests.Builders;
using Khanara.API.Tests.Helpers;
using Khanara.API.Tests.Infrastructure;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Moq;

namespace Khanara.API.Tests.Integration.Controllers;

public class DishesControllerTests : BaseIntegrationTest
{
    public DishesControllerTests(CustomWebApplicationFactory factory) : base(factory)
    {
    }

    private async Task<(AppUser cook, CookProfile profile)> CreateCookWithProfile()
    {
        var cook = await AuthHelper.CreateUserAsync("cook@test.com", "CookPass123!@#", "Cook");
        var profile = new CookProfileBuilder()
            .ForUser(cook.Id)
            .WithKitchenName("Test Kitchen")
            .Build();
        DbContext.CookProfiles.Add(profile);
        await DbContext.SaveChangesAsync();
        return (cook, profile);
    }

    [Fact]
    public async Task CreateDish_AsCook_CreatesSuccessfully()
    {
        // Arrange
        var (cook, profile) = await CreateCookWithProfile();
        var cookClient = await CreateAuthenticatedClient("cook@test.com", "CookPass123!@#", "Cook");

        var createDto = new CreateDishDto
        {
            Name = "Delicious Biryani",
            Description = "Homemade biryani with aromatic spices",
            Price = 18.99m,
            CuisineTag = CuisineTag.Indian,
            DietaryTags = DietaryTags.Vegetarian,
            PortionsPerBatch = 10
        };

        // Act
        var response = await cookClient.PostAsJsonAsync("/api/dishes", createDto);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var dishDto = await response.Content.ReadFromJsonAsync<DishDto>();
        dishDto.Should().NotBeNull();
        dishDto!.Name.Should().Be("Delicious Biryani");
        dishDto.Price.Should().Be(18.99m);
        dishDto.CookProfileId.Should().Be(profile.Id);
        dishDto.PortionsPerBatch.Should().Be(10);
        dishDto.PortionsRemainingToday.Should().Be(10);

        // Verify in database
        DbContext.ChangeTracker.Clear();
        var dbDish = await DbContext.Dishes.FindAsync(dishDto.Id);
        dbDish.Should().NotBeNull();
        dbDish!.CookProfileId.Should().Be(profile.Id);
    }

    [Fact]
    public async Task CreateDish_AsNonCook_ReturnsForbidden()
    {
        // Arrange
        var eater = await AuthHelper.CreateUserAsync("eater@test.com", "EaterPass123!@#", "Eater");
        var eaterClient = await CreateAuthenticatedClient("eater@test.com", "EaterPass123!@#", "Eater");

        var createDto = new CreateDishDto
        {
            Name = "Test Dish",
            Price = 15.99m,
            PortionsPerBatch = 5
        };

        // Act
        var response = await eaterClient.PostAsJsonAsync("/api/dishes", createDto);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task UpdateDish_OwnDish_UpdatesSuccessfully()
    {
        // Arrange
        var (cook, profile) = await CreateCookWithProfile();
        var dish = new DishBuilder()
            .WithName("Original Name")
            .WithPrice(15.99m)
            .ForCook(profile.Id)
            .Build();
        DbContext.Dishes.Add(dish);
        await DbContext.SaveChangesAsync();

        var cookClient = await CreateAuthenticatedClient("cook@test.com", "CookPass123!@#", "Cook");

        var updateDto = new UpdateDishDto
        {
            Name = "Updated Name",
            Price = 19.99m,
            IsAvailable = false
        };

        // Act
        var response = await cookClient.PutAsJsonAsync($"/api/dishes/{dish.Id}", updateDto);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var dishDto = await response.Content.ReadFromJsonAsync<DishDto>();
        dishDto.Should().NotBeNull();
        dishDto!.Name.Should().Be("Updated Name");
        dishDto.Price.Should().Be(19.99m);
        dishDto.IsAvailable.Should().BeFalse();

        // Verify in database
        DbContext.ChangeTracker.Clear();
        var dbDish = await DbContext.Dishes.FindAsync(dish.Id);
        dbDish!.Name.Should().Be("Updated Name");
        dbDish.Price.Should().Be(19.99m);
        dbDish.IsAvailable.Should().BeFalse();
    }

    [Fact]
    public async Task UpdateDish_AnotherCooksDish_ReturnsForbidden()
    {
        // Arrange
        var (cook1, profile1) = await CreateCookWithProfile();
        
        var cook2 = await AuthHelper.CreateUserAsync("cook2@test.com", "CookPass123!@#", "Cook");
        var profile2 = new CookProfileBuilder()
            .ForUser(cook2.Id)
            .WithKitchenName("Other Kitchen")
            .Build();
        DbContext.CookProfiles.Add(profile2);
        await DbContext.SaveChangesAsync();

        var dish = new DishBuilder()
            .WithName("Cook2's Dish")
            .ForCook(profile2.Id)
            .Build();
        DbContext.Dishes.Add(dish);
        await DbContext.SaveChangesAsync();

        var cook1Client = await CreateAuthenticatedClient("cook@test.com", "CookPass123!@#", "Cook");

        var updateDto = new UpdateDishDto
        {
            Name = "Trying to update"
        };

        // Act
        var response = await cook1Client.PutAsJsonAsync($"/api/dishes/{dish.Id}", updateDto);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task UpdateDish_PortionsExceedBatch_ReturnsBadRequest()
    {
        // Arrange
        var (cook, profile) = await CreateCookWithProfile();
        var dish = new DishBuilder()
            .WithPortions(10)
            .ForCook(profile.Id)
            .Build();
        DbContext.Dishes.Add(dish);
        await DbContext.SaveChangesAsync();

        var cookClient = await CreateAuthenticatedClient("cook@test.com", "CookPass123!@#", "Cook");

        var updateDto = new UpdateDishDto
        {
            PortionsRemainingToday = 15 // Exceeds batch of 10
        };

        // Act
        var response = await cookClient.PutAsJsonAsync($"/api/dishes/{dish.Id}", updateDto);

        // Assert
        await response.ShouldBeBadRequest();
        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("cannot exceed PortionsPerBatch");
    }

    [Fact]
    public async Task DeleteDish_OwnDish_DeletesSuccessfully()
    {
        // Arrange
        var (cook, profile) = await CreateCookWithProfile();
        var dish = new DishBuilder()
            .WithName("To Delete")
            .ForCook(profile.Id)
            .Build();
        DbContext.Dishes.Add(dish);
        await DbContext.SaveChangesAsync();

        var cookClient = await CreateAuthenticatedClient("cook@test.com", "CookPass123!@#", "Cook");

        // Act
        var response = await cookClient.DeleteAsync($"/api/dishes/{dish.Id}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Verify deleted from database
        DbContext.ChangeTracker.Clear();
        var dbDish = await DbContext.Dishes.FindAsync(dish.Id);
        dbDish.Should().BeNull();
    }

    [Fact]
    public async Task DeleteDish_AnotherCooksDish_ReturnsForbidden()
    {
        // Arrange
        var (cook1, profile1) = await CreateCookWithProfile();
        
        var cook2 = await AuthHelper.CreateUserAsync("cook2@test.com", "CookPass123!@#", "Cook");
        var profile2 = new CookProfileBuilder()
            .ForUser(cook2.Id)
            .WithKitchenName("Other Kitchen")
            .Build();
        DbContext.CookProfiles.Add(profile2);
        await DbContext.SaveChangesAsync();

        var dish = new DishBuilder()
            .ForCook(profile2.Id)
            .Build();
        DbContext.Dishes.Add(dish);
        await DbContext.SaveChangesAsync();

        var cook1Client = await CreateAuthenticatedClient("cook@test.com", "CookPass123!@#", "Cook");

        // Act
        var response = await cook1Client.DeleteAsync($"/api/dishes/{dish.Id}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task AddDishPhoto_ValidImage_UploadsSuccessfully()
    {
        // Arrange
        var (cook, profile) = await CreateCookWithProfile();
        var dish = new DishBuilder()
            .ForCook(profile.Id)
            .Build();
        DbContext.Dishes.Add(dish);
        await DbContext.SaveChangesAsync();

        // Setup mock photo service
        Factory.MockPhotoService
            .Setup(s => s.UploadPhotoAsync(It.IsAny<IFormFile>()))
            .ReturnsAsync(new CloudinaryDotNet.Actions.ImageUploadResult
            {
                SecureUrl = new Uri("https://test.cloudinary.com/image.jpg"),
                PublicId = "test_public_id"
            });

        var cookClient = await CreateAuthenticatedClient("cook@test.com", "CookPass123!@#", "Cook");

        // Create fake file
        var content = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent(new byte[] { 1, 2, 3, 4 });
        fileContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("image/jpeg");
        content.Add(fileContent, "file", "test.jpg");

        // Act
        var response = await cookClient.PostAsync($"/api/dishes/{dish.Id}/photos", content);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var photoDto = await response.Content.ReadFromJsonAsync<DishPhotoDto>();
        photoDto.Should().NotBeNull();
        photoDto!.Url.Should().Be("https://test.cloudinary.com/image.jpg");

        // Verify photo in database
        var dbDish = await DbContext.Dishes
            .Include(d => d.Photos)
            .FirstOrDefaultAsync(d => d.Id == dish.Id);
        dbDish!.Photos.Should().HaveCount(1);
        dbDish.Photos.First().PublicId.Should().Be("test_public_id");
    }

    [Fact]
    public async Task AddDishPhoto_FirstPhoto_MarkedAsMain()
    {
        // Arrange
        var (cook, profile) = await CreateCookWithProfile();
        var dish = new DishBuilder()
            .ForCook(profile.Id)
            .Build();
        DbContext.Dishes.Add(dish);
        await DbContext.SaveChangesAsync();

        Factory.MockPhotoService
            .Setup(s => s.UploadPhotoAsync(It.IsAny<IFormFile>()))
            .ReturnsAsync(new CloudinaryDotNet.Actions.ImageUploadResult
            {
                SecureUrl = new Uri("https://test.cloudinary.com/image.jpg"),
                PublicId = "test_public_id"
            });

        var cookClient = await CreateAuthenticatedClient("cook@test.com", "CookPass123!@#", "Cook");

        var content = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent(new byte[] { 1, 2, 3, 4 });
        fileContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("image/jpeg");
        content.Add(fileContent, "file", "test.jpg");

        // Act
        var response = await cookClient.PostAsync($"/api/dishes/{dish.Id}/photos", content);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var photoDto = await response.Content.ReadFromJsonAsync<DishPhotoDto>();
        photoDto!.IsMain.Should().BeTrue();

        // Verify in database
        var dbPhoto = await DbContext.DishPhotos.FirstOrDefaultAsync(p => p.DishId == dish.Id);
        dbPhoto!.IsMain.Should().BeTrue();
    }

    [Fact]
    public async Task DeleteDishPhoto_ExistingPhoto_RemovesSuccessfully()
    {
        // Arrange
        var (cook, profile) = await CreateCookWithProfile();
        var dish = new DishBuilder()
            .ForCook(profile.Id)
            .Build();
        DbContext.Dishes.Add(dish);
        await DbContext.SaveChangesAsync();

        var photo = new DishPhoto
        {
            DishId = dish.Id,
            Url = "https://test.cloudinary.com/image.jpg",
            PublicId = "test_public_id",
            IsMain = true
        };
        DbContext.DishPhotos.Add(photo);
        await DbContext.SaveChangesAsync();

        Factory.MockPhotoService
            .Setup(s => s.DeletePhotoAsync("test_public_id"))
            .ReturnsAsync(new CloudinaryDotNet.Actions.DeletionResult { Result = "ok" });

        var cookClient = await CreateAuthenticatedClient("cook@test.com", "CookPass123!@#", "Cook");

        // Act
        var response = await cookClient.DeleteAsync($"/api/dishes/{dish.Id}/photos/{photo.Id}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Verify photo deleted
        DbContext.ChangeTracker.Clear();
        var dbPhoto = await DbContext.DishPhotos.FindAsync(photo.Id);
        dbPhoto.Should().BeNull();

        // Verify mock was called
        Factory.MockPhotoService.Verify(
            s => s.DeletePhotoAsync("test_public_id"),
            Times.Once);
    }

    [Fact]
    public async Task GetDishes_WithFilters_ReturnsMatchingDishes()
    {
        // Arrange
        var (cook, profile) = await CreateCookWithProfile();
        
        var dish1 = new DishBuilder()
            .WithName("Indian Biryani")
            .WithPrice(15.99m)
            .ForCook(profile.Id)
            .Build();
        dish1.CuisineTag = CuisineTag.Indian;

        var dish2 = new DishBuilder()
            .WithName("Filipino Adobo")
            .WithPrice(12.99m)
            .ForCook(profile.Id)
            .Build();
        dish2.CuisineTag = CuisineTag.Filipino;

        var dish3 = new DishBuilder()
            .WithName("Indian Curry")
            .WithPrice(18.99m)
            .ForCook(profile.Id)
            .Build();
        dish3.CuisineTag = CuisineTag.Indian;

        DbContext.Dishes.AddRange(dish1, dish2, dish3);
        await DbContext.SaveChangesAsync();

        // Act - Filter by Indian cuisine
        var response = await Client.GetAsync($"/api/dishes?cuisine={CuisineTag.Indian}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PaginatedResult<DishDto>>();
        result.Should().NotBeNull();
        result!.Items.Should().HaveCount(2);
        result.Items.Should().AllSatisfy(d => d.CuisineTag.Should().Be(CuisineTag.Indian));
    }

    [Fact]
    public async Task GetDishes_WithPagination_ReturnsCorrectPage()
    {
        // Arrange
        var (cook, profile) = await CreateCookWithProfile();
        
        // Create 15 dishes
        for (int i = 1; i <= 15; i++)
        {
            var dish = new DishBuilder()
                .WithName($"Dish {i}")
                .ForCook(profile.Id)
                .Build();
            DbContext.Dishes.Add(dish);
        }
        await DbContext.SaveChangesAsync();

        // Act - Get page 2 with page size 10
        var response = await Client.GetAsync("/api/dishes?pageNumber=2&pageSize=10");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PaginatedResult<DishDto>>();
        result.Should().NotBeNull();
        result!.Items.Should().HaveCount(5); // 15 total, page 2 has 5
        result.Metadata.CurrentPage.Should().Be(2);
        result.Metadata.TotalPages.Should().Be(2);
        result.Metadata.TotalCount.Should().Be(15);
    }

    [Fact]
    public async Task GetDish_ExistingDish_ReturnsDish()
    {
        // Arrange
        var (cook, profile) = await CreateCookWithProfile();
        var dish = new DishBuilder()
            .WithName("Test Dish")
            .WithPrice(15.99m)
            .ForCook(profile.Id)
            .Build();
        DbContext.Dishes.Add(dish);
        await DbContext.SaveChangesAsync();

        // Act
        var response = await Client.GetAsync($"/api/dishes/{dish.Id}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var dishDto = await response.Content.ReadFromJsonAsync<DishDto>();
        dishDto.Should().NotBeNull();
        dishDto!.Id.Should().Be(dish.Id);
        dishDto.Name.Should().Be("Test Dish");
        dishDto.Price.Should().Be(15.99m);
    }

    [Fact]
    public async Task GetDish_NonExistentDish_ReturnsNotFound()
    {
        // Act
        var response = await Client.GetAsync("/api/dishes/99999");

        // Assert
        response.ShouldBeNotFound();
    }
}
