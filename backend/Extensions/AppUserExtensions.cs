using System;
using Khanara.API.DTOs;
using Khanara.API.Entities;
using Khanara.API.Interfaces;

namespace Khanara.API.Extensions;

public static class AppUserExtensions
{
    public static async Task<UserDto> ToDto(this AppUser user, ITokenService tokenService)
    {
        return new UserDto
        {
            Id = user.Id,
            DisplayName = user.DisplayName,
            Email = user.Email!,
            ImageUrl = user.ImageUrl,
            Token = await tokenService.CreateToken(user)
        };

    }
}
