using Khanara.API.DTOs;

namespace Khanara.API.Interfaces;

public interface IDiscoveryRepository
{
    Task<List<DiscoveryCookDto>> GetNearMeAsync(string zip);
    Task<List<DiscoveryCookDto>> GetPopularAsync();
    Task<List<DiscoveryCookDto>> GetNewAsync();
}
