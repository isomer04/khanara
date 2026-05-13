using Khanara.API.Data;
using Khanara.API.Entities;
using Khanara.API.Tests.Builders;
using Microsoft.AspNetCore.Identity;

namespace Khanara.API.Tests.Helpers;

public static class TestDataSeeder
{
    public static async Task SeedBasicData(AppDbContext context, UserManager<AppUser> userManager)
    {
        // Seed test users
        var eater = await new UserBuilder()
            .WithEmail("eater@test.com")
            .WithDisplayName("Test Eater")
            .BuildAsync(userManager);

        var cook = await new UserBuilder()
            .WithEmail("cook@test.com")
            .WithDisplayName("Test Cook")
            .AsCook()
            .BuildAsync(userManager);

        // Seed cook profile
        var cookProfile = new CookProfileBuilder()
            .ForUser(cook.Id)
            .WithKitchenName("Test Kitchen")
            .WithBio("Authentic home-cooked meals")
            .WithServiceZipCodes("12345", "12346")
            .Build();

        context.CookProfiles.Add(cookProfile);
        await context.SaveChangesAsync();

        // Seed dishes
        var dish1 = new DishBuilder()
            .ForCook(cookProfile.Id)
            .WithName("Chicken Biryani")
            .WithPrice(12.99m)
            .WithPortions(10, 10)
            .WithCuisineTag(CuisineTag.Indian)
            .Build();

        var dish2 = new DishBuilder()
            .ForCook(cookProfile.Id)
            .WithName("Vegetable Samosa")
            .WithPrice(5.99m)
            .WithPortions(20, 20)
            .WithCuisineTag(CuisineTag.Indian)
            .WithDietaryTags(DietaryTags.Vegetarian)
            .Build();

        context.Dishes.AddRange(dish1, dish2);
        await context.SaveChangesAsync();
    }
}
