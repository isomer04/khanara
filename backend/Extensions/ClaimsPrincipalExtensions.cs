using System.Security.Claims;

namespace Khanara.API.Extensions;

public static class ClaimsPrincipalExtentions
{
    public static string GetMemberId(this ClaimsPrincipal user)
    {
        return user.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? throw new Exception("Cannot get memberId from token");
    }
}
