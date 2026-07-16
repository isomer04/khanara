using Khanara.API.Data;
using Khanara.API.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Khanara.API.Controllers;

public class AdminController(UserManager<AppUser> userManager, AppDbContext context) : BaseApiController
{
    [Authorize(Policy = "RequireAdminRole")]
    [HttpGet("users-with-roles")]
    public async Task<ActionResult> GetUsersWithRoles()
    {
        // Single query: join AspNetUsers → AspNetUserRoles → AspNetRoles
        var rolesByUser = await context.UserRoles
            .Join(context.Roles,
                ur => ur.RoleId,
                r => r.Id,
                (ur, r) => new { ur.UserId, RoleName = r.Name! })
            .GroupBy(x => x.UserId)
            .ToDictionaryAsync(g => g.Key, g => g.Select(x => x.RoleName).ToList());

        var users = await userManager.Users
            .AsNoTracking()
            .OrderBy(u => u.Email)
            .Select(u => new
            {
                u.Id,
                u.Email,
                Roles = rolesByUser.ContainsKey(u.Id) ? rolesByUser[u.Id] : new List<string>()
            })
            .ToListAsync();

        return Ok(users);
    }

    [Authorize(Policy = "RequireAdminRole")]
    [HttpPost("edit-roles/{userId}")]
    public async Task<ActionResult<IList<string>>> EditRoles(string userId, [FromQuery] string roles)
    {
        if (string.IsNullOrEmpty(roles)) return BadRequest("You must select at least one role");

        var selectedRoles = roles.Split(",").ToArray();

        string[] validRoles = ["Admin", "Cook", "Eater", "Moderator"];
        var invalidRoles = selectedRoles.Except(validRoles).ToArray();
        if (invalidRoles.Length > 0)
            return BadRequest($"Invalid role(s): {string.Join(", ", invalidRoles)}");

        var user = await userManager.FindByIdAsync(userId);
        if (user == null) return BadRequest("Could not retrieve user");

        var userRoles = await userManager.GetRolesAsync(user);

        var result = await userManager.AddToRolesAsync(user, selectedRoles.Except(userRoles));
        if (!result.Succeeded) return BadRequest("Failed to add to roles");

        result = await userManager.RemoveFromRolesAsync(user, userRoles.Except(selectedRoles));
        if (!result.Succeeded) return BadRequest("Failed to remove from roles");

        return Ok(await userManager.GetRolesAsync(user));
    }
}
