using Khanara.API.Entities;

namespace Khanara.API.Tests.Builders;

public class CookProfileBuilder
{
    private string _appUserId = string.Empty;
    private string _kitchenName = "Test Kitchen";
    private string? _bio = "Test bio for a home cook";
    private List<CuisineTag> _cuisineTags = new() { CuisineTag.Indian };
    private List<string> _serviceZipCodes = new() { "12345" };
    private bool _isAcceptingOrders = true;

    public CookProfileBuilder ForUser(string appUserId)
    {
        _appUserId = appUserId;
        return this;
    }

    public CookProfileBuilder WithKitchenName(string kitchenName)
    {
        _kitchenName = kitchenName;
        return this;
    }

    public CookProfileBuilder WithBio(string bio)
    {
        _bio = bio;
        return this;
    }

    public CookProfileBuilder WithCuisineTags(params CuisineTag[] tags)
    {
        _cuisineTags = tags.ToList();
        return this;
    }

    public CookProfileBuilder WithServiceZipCodes(params string[] zipCodes)
    {
        _serviceZipCodes = zipCodes.ToList();
        return this;
    }

    public CookProfileBuilder NotAcceptingOrders()
    {
        _isAcceptingOrders = false;
        return this;
    }

    public CookProfile Build()
    {
        if (string.IsNullOrEmpty(_appUserId))
        {
            throw new InvalidOperationException("AppUserId must be set via ForUser() before building CookProfile");
        }

        return new CookProfile
        {
            AppUserId = _appUserId,
            KitchenName = _kitchenName,
            Bio = _bio,
            CuisineTags = _cuisineTags,
            ServiceZipCodes = _serviceZipCodes,
            IsAcceptingOrders = _isAcceptingOrders
        };
    }
}
