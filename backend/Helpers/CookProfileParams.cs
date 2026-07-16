using Khanara.API.Entities;

namespace Khanara.API.Helpers;

public class CookProfileParams : PagingParams
{
    public CuisineTag? Cuisine { get; set; }
    public string? Zip { get; set; }
}
