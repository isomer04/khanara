using Khanara.API.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Khanara.API.Data;

public class Seed
{
    public static async Task SeedUsers(UserManager<AppUser> userManager, AppDbContext context)
    {
        // Always seed the country food catalog (it's idempotent)
        await SeedCountryFoodCatalog(userManager, context);

        // Only seed test users if no users exist
        if (await userManager.Users.AnyAsync()) return;

        var cook = new AppUser
        {
            UserName = "cook@khanara.dev",
            Email = "cook@khanara.dev",
            DisplayName = "Test Cook"
        };
        await userManager.CreateAsync(cook, "K@h4n@r@Cook2025!");
        await userManager.AddToRoleAsync(cook, "Cook");

        var cookProfile = new CookProfile
        {
            AppUserId = cook.Id,
            KitchenName = "Test Kitchen",
            Bio = "A seed cook account for local development and testing.",
            CuisineTags = [CuisineTag.Bengali, CuisineTag.Indian],
            ServiceZipCodes = ["10001", "10002"],
            IsAcceptingOrders = true
        };
        context.CookProfiles.Add(cookProfile);
        await context.SaveChangesAsync();

        var eater = new AppUser
        {
            UserName = "eater@khanara.dev",
            Email = "eater@khanara.dev",
            DisplayName = "Test Eater"
        };
        await userManager.CreateAsync(eater, "K@h4n@r@Eat3r2025!");
        await userManager.AddToRoleAsync(eater, "Eater");

        var moderator = new AppUser
        {
            UserName = "mod@khanara.dev",
            Email = "mod@khanara.dev",
            DisplayName = "Moderator"
        };
        await userManager.CreateAsync(moderator, "K@h4n@r@M0d2025!");
        await userManager.AddToRolesAsync(moderator, ["Moderator"]);

        var admin = new AppUser
        {
            UserName = "admin@khanara.dev",
            Email = "admin@khanara.dev",
            DisplayName = "Admin"
        };
        await userManager.CreateAsync(admin, "K@h4n@r@4dm1n2025!");
        await userManager.AddToRolesAsync(admin, ["Admin"]);
    }

    public static async Task SeedCountryFoodCatalog(UserManager<AppUser> userManager, AppDbContext context)
    {
        // Check if seed data already exists (idempotency)
        var targetCuisines = new[] {
            CuisineTag.Bengali, CuisineTag.Indian, CuisineTag.Pakistani,
            CuisineTag.Thai, CuisineTag.Chinese, CuisineTag.Lebanese,
            CuisineTag.Turkish, CuisineTag.Vietnamese, CuisineTag.Korean,
            CuisineTag.Filipino
        };

        // Check if seed data with photos already exists (idempotency)
        // We check for dishes with photos to allow re-running to add photos to existing dishes
        var dishesWithPhotos = await context.Dishes
            .Include(d => d.Photos)
            .Where(d => targetCuisines.Contains(d.CuisineTag) && d.Photos.Any())
            .AnyAsync();

        var cooksWithPhotos = await context.CookProfiles
            .Where(cp => targetCuisines.Any(c => cp.CuisineTags.Contains(c))
                         && cp.KitchenPhotoUrl != null)
            .AnyAsync();

        if (dishesWithPhotos && cooksWithPhotos)
        {
            return; // Seed data with photos already exists
        }

        // If dishes exist with photos but cooks don't have photos, update cook profiles
        if (dishesWithPhotos && !cooksWithPhotos)
        {
            var existingCooks = await context.CookProfiles
                .Where(cp => targetCuisines.Any(c => cp.CuisineTags.Contains(c)))
                .ToListAsync();

            foreach (var cook in existingCooks)
            {
                var cuisine = cook.CuisineTags.FirstOrDefault();
                cook.KitchenPhotoUrl = GetKitchenPhotoUrl(cuisine);
            }

            await context.SaveChangesAsync();
            return;
        }

        // If dishes exist but don't have photos, delete them and recreate with photos
        var existingDishes = await context.Dishes
            .Where(d => targetCuisines.Contains(d.CuisineTag))
            .ToListAsync();

        if (existingDishes.Any())
        {
            context.Dishes.RemoveRange(existingDishes);
            await context.SaveChangesAsync();
        }

        // Create cook profiles for each cuisine
        var cookProfiles = await CreateCookProfiles(userManager, context);

        // Create dishes for each cuisine
        await CreateDishes(context, cookProfiles);
    }

    private static async Task<Dictionary<CuisineTag, CookProfile>> CreateCookProfiles(
        UserManager<AppUser> userManager,
        AppDbContext context)
    {
        var cookProfiles = new Dictionary<CuisineTag, CookProfile>();

        var cuisineData = new Dictionary<CuisineTag, (string KitchenName, string Bio, string[] ZipCodes)>
        {
            [CuisineTag.Bengali] = ("Bangla Ranna", "Authentic Bengali home cooking from Dhaka", new[] { "10001", "10002", "10003" }),
            [CuisineTag.Indian] = ("Spice Route Kitchen", "North and South Indian classics", new[] { "10001", "10002", "10003" }),
            [CuisineTag.Pakistani] = ("Lahori Flavors", "Traditional Pakistani dishes from Lahore", new[] { "10004", "10005", "10006" }),
            [CuisineTag.Thai] = ("Bangkok Street Eats", "Authentic Thai street food", new[] { "10007", "10008", "10009" }),
            [CuisineTag.Chinese] = ("Golden Wok", "Sichuan and Cantonese specialties", new[] { "10010", "10011", "10012" }),
            [CuisineTag.Lebanese] = ("Cedar Kitchen", "Fresh Lebanese mezze and grills", new[] { "10013", "10014", "10015" }),
            [CuisineTag.Turkish] = ("Bosphorus Bites", "Turkish home cooking from Istanbul", new[] { "10016", "10017", "10018" }),
            [CuisineTag.Vietnamese] = ("Saigon Kitchen", "Vietnamese comfort food", new[] { "10019", "10020", "10021" }),
            [CuisineTag.Korean] = ("Seoul Food", "Korean home-style cooking", new[] { "10022", "10023", "10024" }),
            [CuisineTag.Filipino] = ("Bahay Kubo Kitchen", "Filipino family recipes", new[] { "10025", "10026", "10027" })
        };

        foreach (var (cuisine, (kitchenName, bio, zipCodes)) in cuisineData)
        {
            var email = $"{cuisine.ToString().ToLower()}cook@khanara.seed";

            // Check if user already exists
            var existingUser = await userManager.FindByEmailAsync(email);
            AppUser cookUser;

            if (existingUser != null)
            {
                cookUser = existingUser;

                // Check if cook profile already exists for this user
                var existingProfile = await context.CookProfiles
                    .FirstOrDefaultAsync(cp => cp.AppUserId == cookUser.Id);

                if (existingProfile != null)
                {
                    cookProfiles[cuisine] = existingProfile;
                    continue; // Skip creating a new profile
                }
            }
            else
            {
                cookUser = new AppUser
                {
                    UserName = email,
                    Email = email,
                    DisplayName = kitchenName
                };
                await userManager.CreateAsync(cookUser, "K@h4n@r@Seed2025!");
                await userManager.AddToRoleAsync(cookUser, "Cook");
            }

            var cookProfile = new CookProfile
            {
                AppUserId = cookUser.Id,
                KitchenName = kitchenName,
                Bio = bio,
                CuisineTags = [cuisine],
                ServiceZipCodes = zipCodes.ToList(),
                IsAcceptingOrders = true,
                KitchenPhotoUrl = GetKitchenPhotoUrl(cuisine)
            };
            context.CookProfiles.Add(cookProfile);
            cookProfiles[cuisine] = cookProfile;
        }

        await context.SaveChangesAsync();
        return cookProfiles;
    }

    private static async Task CreateDishes(
        AppDbContext context,
        Dictionary<CuisineTag, CookProfile> cookProfiles)
    {
        // Mapping of dish names to image filenames
        var dishImageMap = GetDishImageMap();

        // First, backfill photos for existing dishes
        await BackfillDishPhotos(context, dishImageMap);

        foreach (var (cuisine, cookProfile) in cookProfiles)
        {
            var dishes = GetDishesForCuisine(cuisine);

            foreach (var dishData in dishes)
            {
                var dish = new Dish
                {
                    CookProfileId = cookProfile.Id,
                    Name = dishData.Name,
                    Description = dishData.Description,
                    Price = dishData.Price,
                    CuisineTag = cuisine,
                    DietaryTags = dishData.DietaryTags,
                    PortionsPerBatch = dishData.PortionsPerBatch,
                    PortionsRemainingToday = dishData.PortionsPerBatch,
                    IsAvailable = true
                };

                // Add photo if available
                var imageFilename = GetImageFilenameForDish(dishData.Name);
                if (dishImageMap.Contains(imageFilename))
                {
                    dish.Photos.Add(new DishPhoto
                    {
                        Url = $"/images/dishes/{imageFilename}.jpg",
                        IsMain = true
                    });

                    // Only add dish if it has an image
                    context.Dishes.Add(dish);
                }
            }
        }

        await context.SaveChangesAsync();
    }

    // Backfill photos for existing dishes that don't have them
    private static async Task BackfillDishPhotos(AppDbContext context, HashSet<string> dishImageMap)
    {
        var dishesWithoutPhotos = await context.Dishes
            .Include(d => d.Photos)
            .Where(d => !d.Photos.Any())
            .ToListAsync();

        if (!dishesWithoutPhotos.Any()) return;

        foreach (var dish in dishesWithoutPhotos)
        {
            var imageFilename = GetImageFilenameForDish(dish.Name);
            if (dishImageMap.Contains(imageFilename))
            {
                dish.Photos.Add(new DishPhoto
                {
                    Url = $"/images/dishes/{imageFilename}.jpg",
                    IsMain = true
                });
            }
        }

        await context.SaveChangesAsync();
    }

    private static List<DishSeedData> GetDishesForCuisine(CuisineTag cuisine)
    {
        return cuisine switch
        {
            CuisineTag.Bengali => new List<DishSeedData>
            {
                new() { Name = "Ilish Bhapa", Description = "Steamed hilsa fish with mustard paste, a Bengali delicacy", Price = 18.00m, PortionsPerBatch = 6, DietaryTags = DietaryTags.Halal },
                new() { Name = "Shorshe Ilish", Description = "Hilsa fish in mustard sauce", Price = 19.00m, PortionsPerBatch = 6, DietaryTags = DietaryTags.Halal },
                new() { Name = "Chingri Malai Curry", Description = "Prawns in coconut milk curry", Price = 22.00m, PortionsPerBatch = 8, DietaryTags = DietaryTags.Halal | DietaryTags.ContainsDairy },
                new() { Name = "Mochar Ghonto", Description = "Banana blossom curry with coconut", Price = 12.00m, PortionsPerBatch = 10, DietaryTags = DietaryTags.Vegetarian | DietaryTags.Vegan },
                new() { Name = "Shukto", Description = "Mixed vegetable curry with bitter gourd", Price = 11.00m, PortionsPerBatch = 10, DietaryTags = DietaryTags.Vegetarian },
                new() { Name = "Kosha Mangsho", Description = "Slow-cooked mutton curry", Price = 24.00m, PortionsPerBatch = 8, DietaryTags = DietaryTags.Halal },
                new() { Name = "Doi Maach", Description = "Fish in yogurt curry", Price = 16.00m, PortionsPerBatch = 8, DietaryTags = DietaryTags.Halal | DietaryTags.ContainsDairy },
                new() { Name = "Aloo Posto", Description = "Potatoes in poppy seed paste", Price = 10.00m, PortionsPerBatch = 12, DietaryTags = DietaryTags.Vegetarian | DietaryTags.Vegan },
                new() { Name = "Begun Bhaja", Description = "Crispy fried eggplant slices", Price = 9.00m, PortionsPerBatch = 15, DietaryTags = DietaryTags.Vegetarian | DietaryTags.Vegan }
            },

            CuisineTag.Indian => new List<DishSeedData>
            {
                new() { Name = "Butter Chicken", Description = "Creamy tomato-based chicken curry", Price = 18.00m, PortionsPerBatch = 10, DietaryTags = DietaryTags.Halal | DietaryTags.ContainsDairy },
                new() { Name = "Palak Paneer", Description = "Spinach curry with cottage cheese", Price = 14.00m, PortionsPerBatch = 10, DietaryTags = DietaryTags.Vegetarian | DietaryTags.ContainsDairy },
                new() { Name = "Biryani", Description = "Fragrant rice with spiced chicken", Price = 16.00m, PortionsPerBatch = 8, DietaryTags = DietaryTags.Halal },
                new() { Name = "Chole Bhature", Description = "Chickpea curry with fried bread", Price = 12.00m, PortionsPerBatch = 10, DietaryTags = DietaryTags.Vegetarian },
                new() { Name = "Masala Dosa", Description = "Crispy rice crepe with spiced potato filling", Price = 11.00m, PortionsPerBatch = 12, DietaryTags = DietaryTags.Vegetarian | DietaryTags.Vegan },
                new() { Name = "Tandoori Chicken", Description = "Yogurt-marinated grilled chicken", Price = 19.00m, PortionsPerBatch = 10, DietaryTags = DietaryTags.Halal | DietaryTags.ContainsDairy },
                new() { Name = "Dal Makhani", Description = "Black lentils in creamy tomato sauce", Price = 13.00m, PortionsPerBatch = 12, DietaryTags = DietaryTags.Vegetarian | DietaryTags.ContainsDairy },
                new() { Name = "Aloo Gobi", Description = "Potato and cauliflower curry", Price = 10.00m, PortionsPerBatch = 12, DietaryTags = DietaryTags.Vegetarian | DietaryTags.Vegan },
                new() { Name = "Samosa", Description = "Crispy pastry filled with spiced potatoes", Price = 8.00m, PortionsPerBatch = 20, DietaryTags = DietaryTags.Vegetarian | DietaryTags.Vegan },
                new() { Name = "Paneer Tikka", Description = "Grilled cottage cheese with spices", Price = 15.00m, PortionsPerBatch = 10, DietaryTags = DietaryTags.Vegetarian | DietaryTags.ContainsDairy },
                new() { Name = "Hyderabadi Biryani", Description = "Layered rice with spiced goat meat", Price = 20.00m, PortionsPerBatch = 8, DietaryTags = DietaryTags.Halal }
            },

            CuisineTag.Pakistani => new List<DishSeedData>
            {
                new() { Name = "Nihari", Description = "Slow-cooked beef stew with spices", Price = 20.00m, PortionsPerBatch = 8, DietaryTags = DietaryTags.Halal },
                new() { Name = "Haleem", Description = "Wheat and meat porridge", Price = 16.00m, PortionsPerBatch = 10, DietaryTags = DietaryTags.Halal },
                new() { Name = "Karahi Chicken", Description = "Chicken cooked in wok with tomatoes", Price = 17.00m, PortionsPerBatch = 10, DietaryTags = DietaryTags.Halal },
                new() { Name = "Seekh Kebab", Description = "Spiced minced meat skewers", Price = 18.00m, PortionsPerBatch = 12, DietaryTags = DietaryTags.Halal },
                new() { Name = "Chapli Kebab", Description = "Flat minced meat patties from Peshawar", Price = 15.00m, PortionsPerBatch = 12, DietaryTags = DietaryTags.Halal },
                new() { Name = "Aloo Keema", Description = "Minced meat with potatoes", Price = 14.00m, PortionsPerBatch = 10, DietaryTags = DietaryTags.Halal },
                new() { Name = "Daal Chawal", Description = "Lentils with rice", Price = 10.00m, PortionsPerBatch = 12, DietaryTags = DietaryTags.Vegetarian | DietaryTags.Vegan },
                new() { Name = "Paya", Description = "Slow-cooked trotters soup", Price = 19.00m, PortionsPerBatch = 6, DietaryTags = DietaryTags.Halal },
                new() { Name = "Chicken Tikka", Description = "Grilled marinated chicken pieces", Price = 16.00m, PortionsPerBatch = 12, DietaryTags = DietaryTags.Halal | DietaryTags.ContainsDairy },
                new() { Name = "Aloo Palak", Description = "Spinach and potato curry", Price = 11.00m, PortionsPerBatch = 12, DietaryTags = DietaryTags.Vegetarian | DietaryTags.Vegan }
            },

            CuisineTag.Thai => new List<DishSeedData>
            {
                new() { Name = "Pad Thai", Description = "Stir-fried rice noodles with shrimp", Price = 14.00m, PortionsPerBatch = 10, DietaryTags = DietaryTags.ContainsNuts },
                new() { Name = "Green Curry", Description = "Coconut-based curry with chicken", Price = 15.00m, PortionsPerBatch = 10, DietaryTags = DietaryTags.None },
                new() { Name = "Tom Yum Goong", Description = "Spicy and sour shrimp soup", Price = 13.00m, PortionsPerBatch = 8, DietaryTags = DietaryTags.None },
                new() { Name = "Massaman Curry", Description = "Rich peanut curry with beef", Price = 16.00m, PortionsPerBatch = 8, DietaryTags = DietaryTags.ContainsNuts },
                new() { Name = "Som Tam", Description = "Green papaya salad", Price = 10.00m, PortionsPerBatch = 12, DietaryTags = DietaryTags.Vegan | DietaryTags.ContainsNuts },
                new() { Name = "Pad Krapow Moo", Description = "Basil pork stir-fry", Price = 13.00m, PortionsPerBatch = 10, DietaryTags = DietaryTags.None },
                new() { Name = "Khao Soi", Description = "Coconut curry noodle soup", Price = 14.00m, PortionsPerBatch = 8, DietaryTags = DietaryTags.None },
                new() { Name = "Larb Gai", Description = "Spicy minced chicken salad", Price = 12.00m, PortionsPerBatch = 10, DietaryTags = DietaryTags.None },
                new() { Name = "Panang Curry", Description = "Thick red curry with pork", Price = 15.00m, PortionsPerBatch = 10, DietaryTags = DietaryTags.ContainsNuts },
                new() { Name = "Pad See Ew", Description = "Stir-fried wide noodles with chicken", Price = 13.00m, PortionsPerBatch = 10, DietaryTags = DietaryTags.None }
            },

            CuisineTag.Chinese => new List<DishSeedData>
            {
                new() { Name = "Kung Pao Chicken", Description = "Spicy chicken with peanuts", Price = 14.00m, PortionsPerBatch = 10, DietaryTags = DietaryTags.ContainsNuts },
                new() { Name = "Mapo Tofu", Description = "Spicy tofu in chili bean sauce", Price = 12.00m, PortionsPerBatch = 10, DietaryTags = DietaryTags.Vegetarian },
                new() { Name = "Sweet Sour Pork", Description = "Crispy pork in tangy sauce", Price = 15.00m, PortionsPerBatch = 10, DietaryTags = DietaryTags.None },
                new() { Name = "Peking Duck", Description = "Crispy roasted duck with pancakes", Price = 28.00m, PortionsPerBatch = 6, DietaryTags = DietaryTags.None },
                new() { Name = "Dumplings", Description = "Steamed pork and vegetable dumplings", Price = 11.00m, PortionsPerBatch = 15, DietaryTags = DietaryTags.None },
                new() { Name = "Chow Mein", Description = "Stir-fried noodles with vegetables", Price = 12.00m, PortionsPerBatch = 12, DietaryTags = DietaryTags.Vegetarian },
                new() { Name = "Hot Pot", Description = "Sichuan-style spicy broth with meats", Price = 25.00m, PortionsPerBatch = 6, DietaryTags = DietaryTags.None },
                new() { Name = "Char Siu", Description = "BBQ pork with honey glaze", Price = 17.00m, PortionsPerBatch = 10, DietaryTags = DietaryTags.None },
                new() { Name = "Fried Rice", Description = "Wok-fried rice with egg and vegetables", Price = 10.00m, PortionsPerBatch = 12, DietaryTags = DietaryTags.Vegetarian },
                new() { Name = "Dan Dan Noodles", Description = "Spicy Sichuan noodles with pork", Price = 13.00m, PortionsPerBatch = 10, DietaryTags = DietaryTags.ContainsNuts },
                new() { Name = "General Tsos Chicken", Description = "Crispy chicken in sweet-spicy sauce", Price = 14.00m, PortionsPerBatch = 10, DietaryTags = DietaryTags.None },
                new() { Name = "Wonton Soup", Description = "Pork wontons in clear broth", Price = 11.00m, PortionsPerBatch = 10, DietaryTags = DietaryTags.None }
            },

            CuisineTag.Lebanese => new List<DishSeedData>
            {
                new() { Name = "Shawarma", Description = "Marinated chicken wrap with garlic sauce", Price = 12.00m, PortionsPerBatch = 12, DietaryTags = DietaryTags.Halal | DietaryTags.ContainsDairy },
                new() { Name = "Falafel", Description = "Fried chickpea fritters", Price = 9.00m, PortionsPerBatch = 15, DietaryTags = DietaryTags.Vegetarian | DietaryTags.Vegan },
                new() { Name = "Hummus", Description = "Chickpea dip with tahini", Price = 8.00m, PortionsPerBatch = 15, DietaryTags = DietaryTags.Vegetarian | DietaryTags.Vegan },
                new() { Name = "Tabbouleh", Description = "Parsley and bulgur salad", Price = 10.00m, PortionsPerBatch = 12, DietaryTags = DietaryTags.Vegetarian | DietaryTags.Vegan },
                new() { Name = "Kibbeh", Description = "Bulgur and meat croquettes", Price = 14.00m, PortionsPerBatch = 12, DietaryTags = DietaryTags.Halal },
                new() { Name = "Fattoush", Description = "Mixed greens with crispy pita", Price = 11.00m, PortionsPerBatch = 12, DietaryTags = DietaryTags.Vegetarian | DietaryTags.Vegan },
                new() { Name = "Kafta", Description = "Grilled minced meat skewers", Price = 15.00m, PortionsPerBatch = 10, DietaryTags = DietaryTags.Halal },
                new() { Name = "Baba Ganoush", Description = "Smoky eggplant dip", Price = 9.00m, PortionsPerBatch = 15, DietaryTags = DietaryTags.Vegetarian | DietaryTags.Vegan },
                new() { Name = "Manakish", Description = "Flatbread with za'atar", Price = 8.00m, PortionsPerBatch = 15, DietaryTags = DietaryTags.Vegetarian | DietaryTags.Vegan },
                new() { Name = "Shish Tawook", Description = "Grilled chicken skewers", Price = 16.00m, PortionsPerBatch = 10, DietaryTags = DietaryTags.Halal | DietaryTags.ContainsDairy }
            },

            CuisineTag.Turkish => new List<DishSeedData>
            {
                new() { Name = "Doner Kebab", Description = "Rotisserie meat wrap", Price = 13.00m, PortionsPerBatch = 12, DietaryTags = DietaryTags.Halal },
                new() { Name = "Lahmacun", Description = "Turkish flatbread with minced meat", Price = 10.00m, PortionsPerBatch = 15, DietaryTags = DietaryTags.Halal },
                new() { Name = "Manti", Description = "Turkish dumplings with yogurt sauce", Price = 14.00m, PortionsPerBatch = 10, DietaryTags = DietaryTags.Halal | DietaryTags.ContainsDairy },
                new() { Name = "Iskender Kebab", Description = "Sliced lamb over bread with tomato sauce", Price = 18.00m, PortionsPerBatch = 8, DietaryTags = DietaryTags.Halal | DietaryTags.ContainsDairy },
                new() { Name = "Kofte", Description = "Spiced meatballs in tomato sauce", Price = 15.00m, PortionsPerBatch = 10, DietaryTags = DietaryTags.Halal },
                new() { Name = "Pide", Description = "Turkish flatbread with cheese and meat", Price = 12.00m, PortionsPerBatch = 10, DietaryTags = DietaryTags.Halal | DietaryTags.ContainsDairy },
                new() { Name = "Imam Bayildi", Description = "Stuffed eggplant with vegetables", Price = 11.00m, PortionsPerBatch = 10, DietaryTags = DietaryTags.Vegetarian | DietaryTags.Vegan },
                new() { Name = "Menemen", Description = "Turkish scrambled eggs with peppers", Price = 9.00m, PortionsPerBatch = 12, DietaryTags = DietaryTags.Vegetarian },
                new() { Name = "Borek", Description = "Flaky pastry with cheese or meat", Price = 10.00m, PortionsPerBatch = 15, DietaryTags = DietaryTags.Vegetarian | DietaryTags.ContainsDairy },
                new() { Name = "Adana Kebab", Description = "Spicy minced meat skewers", Price = 16.00m, PortionsPerBatch = 10, DietaryTags = DietaryTags.Halal }
            },

            CuisineTag.Vietnamese => new List<DishSeedData>
            {
                new() { Name = "Pho", Description = "Beef noodle soup with herbs", Price = 13.00m, PortionsPerBatch = 10, DietaryTags = DietaryTags.None },
                new() { Name = "Banh Mi", Description = "Vietnamese sandwich with pork", Price = 10.00m, PortionsPerBatch = 15, DietaryTags = DietaryTags.None },
                new() { Name = "Bun Cha", Description = "Grilled pork with vermicelli", Price = 14.00m, PortionsPerBatch = 10, DietaryTags = DietaryTags.None },
                new() { Name = "Goi Cuon", Description = "Fresh spring rolls with shrimp", Price = 11.00m, PortionsPerBatch = 15, DietaryTags = DietaryTags.None },
                new() { Name = "Com Tam", Description = "Broken rice with grilled pork", Price = 12.00m, PortionsPerBatch = 12, DietaryTags = DietaryTags.None },
                new() { Name = "Bun Bo Hue", Description = "Spicy beef noodle soup", Price = 14.00m, PortionsPerBatch = 8, DietaryTags = DietaryTags.None },
                new() { Name = "Banh Xeo", Description = "Crispy Vietnamese crepe", Price = 12.00m, PortionsPerBatch = 10, DietaryTags = DietaryTags.None },
                new() { Name = "Ca Kho To", Description = "Caramelized fish in clay pot", Price = 15.00m, PortionsPerBatch = 8, DietaryTags = DietaryTags.None },
                new() { Name = "Pho Ga", Description = "Chicken noodle soup", Price = 12.00m, PortionsPerBatch = 10, DietaryTags = DietaryTags.None },
                new() { Name = "Bun Thit Nuong", Description = "Grilled pork vermicelli bowl", Price = 13.00m, PortionsPerBatch = 10, DietaryTags = DietaryTags.None }
            },

            CuisineTag.Korean => new List<DishSeedData>
            {
                new() { Name = "Bibimbap", Description = "Mixed rice with vegetables and beef", Price = 14.00m, PortionsPerBatch = 10, DietaryTags = DietaryTags.None },
                new() { Name = "Bulgogi", Description = "Marinated grilled beef", Price = 16.00m, PortionsPerBatch = 10, DietaryTags = DietaryTags.None },
                new() { Name = "Kimchi Jjigae", Description = "Kimchi stew with pork", Price = 13.00m, PortionsPerBatch = 10, DietaryTags = DietaryTags.None },
                new() { Name = "Japchae", Description = "Stir-fried glass noodles with vegetables", Price = 12.00m, PortionsPerBatch = 12, DietaryTags = DietaryTags.Vegetarian },
                new() { Name = "Galbi", Description = "Grilled short ribs", Price = 22.00m, PortionsPerBatch = 8, DietaryTags = DietaryTags.None },
                new() { Name = "Tteokbokki", Description = "Spicy rice cakes", Price = 10.00m, PortionsPerBatch = 15, DietaryTags = DietaryTags.Vegetarian },
                new() { Name = "Samgyeopsal", Description = "Grilled pork belly", Price = 18.00m, PortionsPerBatch = 10, DietaryTags = DietaryTags.None },
                new() { Name = "Sundubu Jjigae", Description = "Soft tofu stew", Price = 12.00m, PortionsPerBatch = 10, DietaryTags = DietaryTags.Vegetarian },
                new() { Name = "Kimbap", Description = "Korean rice rolls", Price = 9.00m, PortionsPerBatch = 15, DietaryTags = DietaryTags.Vegetarian },
                new() { Name = "Jajangmyeon", Description = "Black bean noodles with pork", Price = 13.00m, PortionsPerBatch = 10, DietaryTags = DietaryTags.None }
            },

            CuisineTag.Filipino => new List<DishSeedData>
            {
                new() { Name = "Adobo", Description = "Chicken braised in vinegar and soy sauce", Price = 13.00m, PortionsPerBatch = 10, DietaryTags = DietaryTags.None },
                new() { Name = "Sinigang", Description = "Sour tamarind soup with pork", Price = 14.00m, PortionsPerBatch = 10, DietaryTags = DietaryTags.None },
                new() { Name = "Lechon Kawali", Description = "Crispy fried pork belly", Price = 16.00m, PortionsPerBatch = 10, DietaryTags = DietaryTags.None },
                new() { Name = "Kare-Kare", Description = "Oxtail in peanut sauce", Price = 18.00m, PortionsPerBatch = 8, DietaryTags = DietaryTags.ContainsNuts },
                new() { Name = "Pancit", Description = "Stir-fried noodles with vegetables", Price = 11.00m, PortionsPerBatch = 12, DietaryTags = DietaryTags.None },
                new() { Name = "Lumpia", Description = "Filipino spring rolls", Price = 9.00m, PortionsPerBatch = 20, DietaryTags = DietaryTags.None },
                new() { Name = "Sisig", Description = "Sizzling pork with onions and peppers", Price = 15.00m, PortionsPerBatch = 10, DietaryTags = DietaryTags.None },
                new() { Name = "Bicol Express", Description = "Spicy pork in coconut milk", Price = 14.00m, PortionsPerBatch = 10, DietaryTags = DietaryTags.None },
                new() { Name = "Pinakbet", Description = "Mixed vegetable stew with shrimp paste", Price = 12.00m, PortionsPerBatch = 10, DietaryTags = DietaryTags.None },
                new() { Name = "Chicken Inasal", Description = "Grilled marinated chicken", Price = 13.00m, PortionsPerBatch = 12, DietaryTags = DietaryTags.None }
            },

            _ => new List<DishSeedData>()
        };
    }

    private class DishSeedData
    {
        public required string Name { get; set; }
        public required string Description { get; set; }
        public decimal Price { get; set; }
        public int PortionsPerBatch { get; set; }
        public DietaryTags DietaryTags { get; set; }
    }

    // Helper method to get available dish images
    private static HashSet<string> GetDishImageMap()
    {
        return new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "adana-kebab", "adobo", "aloo-gobi", "aloo-keema", "aloo-palak", "aloo-posto",
            "baba-ganoush", "banh-mi", "banh-xeo", "begun-bhaja", "bibimbap", "bicol-express",
            "biryani", "borek", "bulgogi", "bun-bo-hue", "bun-cha", "bun-thit-nuong",
            "butter-chicken", "ca-kho-to", "chapli-kebab", "char-siu", "chicken-inasal",
            "chicken-tikka", "chingri-malai-curry", "chole-bhature", "chow-mein", "com-tam",
            "daal-chawal", "dal-makhani", "dan-dan-noodles", "doi-maach", "doner-kebab",
            "dumplings", "falafel", "fattoush", "fried-rice", "galbi", "general-tsos-chicken",
            "goi-cuon", "green-curry", "haleem", "hot-pot", "hummus", "hyderabadi-biryani",
            "ilish-bhapa", "imam-bayildi", "iskender-kebab", "jajangmyeon", "japchae", "kafta",
            "karahi-chicken", "kare-kare", "khao-soi", "kibbeh", "kimbap", "kimchi-jjigae",
            "kofte", "kosha-mangsho", "kung-pao-chicken", "lahmacun", "larb-gai", "lechon-kawali",
            "lumpia", "manakish", "manti", "mapo-tofu", "masala-dosa",
            "massaman-curry", "menemen", "mochar-ghonto", "nihari", "pad-krapow-moo", "pad-see-ew",
            "pad-thai", "palak-paneer", "panang-curry", "pancit", "paneer-tikka", "paya",
            "peking-duck", "pho", "pho-ga", "pide", "pinakbet", "samgyeopsal", "samosa",
            "seekh-kebab", "shawarma", "shish-tawook", "shorshe-ilish", "shukto", "sinigang",
            "sisig", "som-tam", "sundubu-jjigae", "sweet-sour-pork", "tabbouleh", "tandoori-chicken",
            "tom-yum-goong", "tteokbokki", "wonton-soup"
        };
    }

    // Helper method to convert dish name to image filename
    private static string GetImageFilenameForDish(string dishName)
    {
        // Convert dish name to lowercase and replace spaces with hyphens
        return dishName.ToLowerInvariant()
            .Replace(" ", "-")
            .Replace("'", "");
    }

    // Helper method to get kitchen photo URL for a cuisine
    private static string? GetKitchenPhotoUrl(CuisineTag cuisine)
    {
        var kitchenImageMap = GetKitchenImageMap();
        var filename = GetKitchenFilenameForCuisine(cuisine);

        if (kitchenImageMap.Contains(filename))
        {
            return $"/images/kitchens/{filename}.jpg";
        }

        return null;
    }

    // Helper method to get available kitchen images
    private static HashSet<string> GetKitchenImageMap()
    {
        return new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "bangla-ranna",
            "spice-route-kitchen",
            "lahori-flavors",
            "bangkok-street-eats",
            "golden-wok",
            "cedar-kitchen",
            "bosphorus-bites",
            "saigon-kitchen",
            "seoul-food",
            "bahay-kubo-kitchen"
        };
    }

    // Helper method to convert cuisine tag to kitchen filename
    private static string GetKitchenFilenameForCuisine(CuisineTag cuisine)
    {
        return cuisine switch
        {
            CuisineTag.Bengali => "bangla-ranna",
            CuisineTag.Indian => "spice-route-kitchen",
            CuisineTag.Pakistani => "lahori-flavors",
            CuisineTag.Thai => "bangkok-street-eats",
            CuisineTag.Chinese => "golden-wok",
            CuisineTag.Lebanese => "cedar-kitchen",
            CuisineTag.Turkish => "bosphorus-bites",
            CuisineTag.Vietnamese => "saigon-kitchen",
            CuisineTag.Korean => "seoul-food",
            CuisineTag.Filipino => "bahay-kubo-kitchen",
            _ => ""
        };
    }
}
