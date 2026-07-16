using Khanara.API.DTOs;
using Khanara.API.Extensions;
using Khanara.API.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Khanara.API.Entities;
using Microsoft.EntityFrameworkCore;

namespace Khanara.API.Controllers;

[Authorize]
public class MembersController(
    UserManager<AppUser> userManager,
    IPhotoService photoService) : BaseApiController
{
    [HttpGet("{id}")]
    public async Task<ActionResult<MemberDto>> GetMember(string id)
    {
        var callerId = User.GetMemberId();
        if (callerId != id) return Forbid();

        var user = await userManager.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == id);
        if (user == null) return NotFound();

        return Ok(MapToDto(user));
    }

    [HttpPut]
    public async Task<ActionResult<MemberDto>> UpdateMember(UpdateMemberDto dto)
    {
        var userId = User.GetMemberId();
        var user = await userManager.FindByIdAsync(userId);
        if (user == null) return NotFound();

        user.DisplayName = dto.DisplayName;

        var result = await userManager.UpdateAsync(user);
        if (!result.Succeeded)
        {
            foreach (var error in result.Errors)
                ModelState.AddModelError("identity", error.Description);
            return ValidationProblem();
        }

        return Ok(MapToDto(user));
    }

    [HttpPost("add-photo")]
    public async Task<ActionResult<MemberDto>> AddPhoto(IFormFile file)
    {
        var userId = User.GetMemberId();
        var user = await userManager.FindByIdAsync(userId);
        if (user == null) return NotFound();

        var uploadResult = await photoService.UploadPhotoAsync(file);
        if (uploadResult.Error != null) return BadRequest(uploadResult.Error.Message);

        var oldImageUrl = user.ImageUrl;
        user.ImageUrl = uploadResult.SecureUrl.AbsoluteUri;

        var result = await userManager.UpdateAsync(user);
        if (!result.Succeeded) return BadRequest("Failed to update profile photo");

        // Delete old Cloudinary image if it was previously uploaded.
        if (!string.IsNullOrEmpty(oldImageUrl) && oldImageUrl.Contains("cloudinary"))
        {
            var oldPublicId = ExtractPublicId(oldImageUrl);
            if (oldPublicId != null)
                await photoService.DeletePhotoAsync(oldPublicId);
        }

        return Ok(MapToDto(user));
    }

    private static MemberDto MapToDto(AppUser user) => new()
    {
        Id = user.Id,
        DisplayName = user.DisplayName,
        ImageUrl = user.ImageUrl,
        Email = user.Email!
    };

    private static string? ExtractPublicId(string url)
    {
        try
        {
            var uri = new Uri(url);
            var segments = uri.AbsolutePath.Split('/');
            var uploadIndex = Array.IndexOf(segments, "upload");
            if (uploadIndex < 0 || uploadIndex + 2 >= segments.Length) return null;

            // Skip the version segment (v12345) if present.
            var afterUpload = segments[uploadIndex + 1];
            var startIndex = afterUpload.StartsWith('v') && int.TryParse(afterUpload[1..], out _)
                ? uploadIndex + 2
                : uploadIndex + 1;

            var fileWithExt = segments[^1];
            var file = fileWithExt[..fileWithExt.LastIndexOf('.')];
            var folder = string.Join("/", segments[(startIndex)..(segments.Length - 1)]);
            return string.IsNullOrEmpty(folder) ? file : $"{folder}/{file}";
        }
        catch
        {
            return null;
        }
    }
}
