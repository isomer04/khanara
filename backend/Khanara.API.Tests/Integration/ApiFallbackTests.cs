using System.Net;
using Khanara.API.Tests.Infrastructure;

namespace Khanara.API.Tests.Integration;

public class ApiFallbackTests : BaseIntegrationTest
{
    public ApiFallbackTests(CustomWebApplicationFactory factory) : base(factory)
    {
    }

    [Theory]
    [InlineData("/api/doesnotexist")]
    [InlineData("/api/cooks/abc")] // misses the {id:int} route constraint
    [InlineData("/api/orders/1/nope")]
    public async Task UnknownApiRoute_ReturnsNotFound_NotTheSpaShell(string url)
    {
        // Act
        var response = await Client.GetAsync(url);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        response.Content.Headers.ContentType?.MediaType.Should().NotBe("text/html");
    }
}
