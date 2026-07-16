using System.Text.RegularExpressions;
using Khanara.API.DTOs;
using Khanara.API.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Khanara.API.Controllers;

[AllowAnonymous]
public class DiscoveryController(IUnitOfWork uow) : BaseApiController
{
    [HttpGet("near-me")]
    public async Task<ActionResult<List<DiscoveryCookDto>>> GetNearMe([FromQuery] string? zip)
    {
        if (string.IsNullOrWhiteSpace(zip) || !Regex.IsMatch(zip, @"^\d{5}$"))
            return BadRequest("A valid 5-digit zip code is required");

        var results = await uow.DiscoveryRepository.GetNearMeAsync(zip);
        return Ok(results);
    }

    [HttpGet("popular")]
    public async Task<ActionResult<List<DiscoveryCookDto>>> GetPopular()
    {
        var results = await uow.DiscoveryRepository.GetPopularAsync();
        return Ok(results);
    }

    [HttpGet("new")]
    public async Task<ActionResult<List<DiscoveryCookDto>>> GetNew()
    {
        var results = await uow.DiscoveryRepository.GetNewAsync();
        return Ok(results);
    }
}
