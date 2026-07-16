using System.IdentityModel.Tokens.Jwt;
using System.Linq.Expressions;
using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using Khanara.API.Data;
using Khanara.API.Entities;
using Khanara.API.Helpers;
using Microsoft.EntityFrameworkCore;

namespace Khanara.API.Tests.Helpers;

public static class AssertionExtensions
{
    // HTTP Response Assertions
    public static async Task<T> ShouldBeSuccessWithContent<T>(this HttpResponseMessage response)
    {
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var content = await response.Content.ReadFromJsonAsync<T>();
        content.Should().NotBeNull();
        return content!;
    }

    public static void ShouldBeCreated(this HttpResponseMessage response, string? locationHeader = null)
    {
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        if (locationHeader != null)
        {
            response.Headers.Location.Should().NotBeNull();
            response.Headers.Location!.ToString().Should().Contain(locationHeader);
        }
    }

    public static async Task ShouldBeBadRequest(this HttpResponseMessage response, string? errorMessage = null)
    {
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        if (errorMessage != null)
        {
            var content = await response.Content.ReadAsStringAsync();
            content.Should().Contain(errorMessage);
        }
    }

    public static void ShouldBeUnauthorized(this HttpResponseMessage response)
    {
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    public static void ShouldBeForbidden(this HttpResponseMessage response)
    {
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    public static void ShouldBeNotFound(this HttpResponseMessage response)
    {
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    public static void ShouldBeConflict(this HttpResponseMessage response)
    {
        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    // JWT Token Assertions
    public static void ShouldBeValidJwtToken(this string token, string expectedEmail)
    {
        token.Should().NotBeNullOrEmpty();

        var tokenHandler = new JwtSecurityTokenHandler();
        var jwtToken = tokenHandler.ReadJwtToken(token);

        // JwtSecurityTokenHandler maps ClaimTypes.Email (long URI) to the short "email"
        // claim name when writing/reading tokens, so check both forms.
        jwtToken.Claims.Should().Contain(c =>
            (c.Type == ClaimTypes.Email || c.Type == JwtRegisteredClaimNames.Email) &&
            c.Value == expectedEmail);
        jwtToken.ValidTo.Should().BeAfter(DateTime.UtcNow);
    }

    public static void ShouldHaveRole(this string token, string role)
    {
        var tokenHandler = new JwtSecurityTokenHandler();
        var jwtToken = tokenHandler.ReadJwtToken(token);

        // ClaimTypes.Role maps to "role" in JWT short form
        jwtToken.Claims.Should().Contain(c =>
            (c.Type == ClaimTypes.Role || c.Type == "role") && c.Value == role);
    }

    // Database State Assertions
    public static async Task ShouldExistInDatabase<T>(
        this AppDbContext context,
        Expression<Func<T, bool>> predicate) where T : class
    {
        var entity = await context.Set<T>().FirstOrDefaultAsync(predicate);
        entity.Should().NotBeNull($"Expected entity of type {typeof(T).Name} to exist in database");
    }

    public static async Task ShouldNotExistInDatabase<T>(
        this AppDbContext context,
        Expression<Func<T, bool>> predicate) where T : class
    {
        var entity = await context.Set<T>().FirstOrDefaultAsync(predicate);
        entity.Should().BeNull($"Expected entity of type {typeof(T).Name} to not exist in database");
    }

    public static async Task<int> CountInDatabase<T>(
        this AppDbContext context,
        Expression<Func<T, bool>> predicate) where T : class
    {
        return await context.Set<T>().CountAsync(predicate);
    }

    // Pagination Assertions
    public static void ShouldHaveValidPagination<T>(
        this PaginatedResult<T> result,
        int expectedPageSize,
        int? expectedTotalCount = null)
    {
        result.Should().NotBeNull();
        result.Items.Should().NotBeNull();
        result.Metadata.Should().NotBeNull();
        result.Items.Count.Should().BeLessOrEqualTo(expectedPageSize);
        result.Metadata.PageSize.Should().Be(expectedPageSize);
        result.Metadata.CurrentPage.Should().BeGreaterThan(0);

        if (expectedTotalCount.HasValue)
        {
            result.Metadata.TotalCount.Should().Be(expectedTotalCount.Value);
            result.Metadata.TotalPages.Should().Be((int)Math.Ceiling(expectedTotalCount.Value / (double)expectedPageSize));
        }
    }

    // Order Assertions
    public static void ShouldHaveStatus(this Order order, OrderStatus expectedStatus)
    {
        order.Status.Should().Be(expectedStatus);
    }

    public static void ShouldHavePaymentStatus(this Order order, PaymentStatus expectedStatus)
    {
        order.PaymentStatus.Should().Be(expectedStatus);
    }

    public static void ShouldHaveItems(this Order order, int expectedCount)
    {
        order.Items.Should().HaveCount(expectedCount);
    }

    public static void ShouldHaveTotalAmount(this Order order, decimal expectedAmount)
    {
        order.TotalAmount.Should().Be(expectedAmount);
    }
}
