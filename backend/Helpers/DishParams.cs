using Khanara.API.Entities;

namespace Khanara.API.Helpers;

public class DishParams : PagingParams
{
    public CuisineTag? Cuisine { get; set; }
    public DietaryTags? Dietary { get; set; }
    public string? Zip { get; set; }
}
