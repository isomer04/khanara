using Khanara.API.Entities;

namespace Khanara.API.Interfaces;

public interface ITokenService
{
    Task<string> CreateToken(AppUser user);
    string GenerateRefreshToken();

}
