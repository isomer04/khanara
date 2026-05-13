using Khanara.API.Entities;

namespace Khanara.API.Tests.Builders;

public class DishBuilder
{
    private string _name = "Test Dish";
    private decimal _price = 15.99m;
    private int _portionsPerBatch = 10;
    private int _portionsRemainingToday = 10;
    private bool _isAvailable = true;
    private int _cookProfileId;
    private CuisineTag _cuisineTag = CuisineTag.Indian;
    private DietaryTags _dietaryTags = DietaryTags.None;

    public DishBuilder WithName(string name)
    {
        _name = name;
        return this;
    }

    public DishBuilder WithPrice(decimal price)
    {
        _price = price;
        return this;
    }

    public DishBuilder WithPortions(int perBatch, int? remaining = null)
    {
        _portionsPerBatch = perBatch;
        _portionsRemainingToday = remaining ?? perBatch;
        return this;
    }

    public DishBuilder Unavailable()
    {
        _isAvailable = false;
        return this;
    }

    public DishBuilder ForCook(int cookProfileId)
    {
        _cookProfileId = cookProfileId;
        return this;
    }

    public DishBuilder WithCuisineTag(CuisineTag cuisineTag)
    {
        _cuisineTag = cuisineTag;
        return this;
    }

    public DishBuilder WithDietaryTags(DietaryTags dietaryTags)
    {
        _dietaryTags = dietaryTags;
        return this;
    }

    public Dish Build()
    {
        return new Dish
        {
            Name = _name,
            Description = "Test description",
            Price = _price,
            PortionsPerBatch = _portionsPerBatch,
            PortionsRemainingToday = _portionsRemainingToday,
            IsAvailable = _isAvailable,
            CookProfileId = _cookProfileId,
            CuisineTag = _cuisineTag,
            DietaryTags = _dietaryTags
        };
    }
}
