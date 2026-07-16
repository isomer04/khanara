using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Khanara.API.Middleware;

public class ExceptionMiddleware(RequestDelegate next,
    ILogger<ExceptionMiddleware> logger, IHostEnvironment env)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
            // Client disconnected — not an application error, no need to log or respond
        }
        catch (DbUpdateConcurrencyException ex)
        {
            logger.LogWarning(ex, "Concurrency conflict on {Path}", context.Request.Path);
            await WriteProblemAsync(context, StatusCodes.Status409Conflict,
                "Conflict",
                "The resource was modified by another request. Please refresh and try again.",
                env.IsDevelopment() ? ex.ToString() : null);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unhandled exception on {Path}", context.Request.Path);
            await WriteProblemAsync(context, StatusCodes.Status500InternalServerError,
                "Internal Server Error",
                env.IsDevelopment() ? ex.Message : "An unexpected error occurred.",
                env.IsDevelopment() ? ex.StackTrace : null);
        }
    }

    private static async Task WriteProblemAsync(
        HttpContext context, int statusCode, string title, string detail, string? instance)
    {
        context.Response.ContentType = "application/problem+json";
        context.Response.StatusCode = statusCode;

        var problem = new ProblemDetails
        {
            Status = statusCode,
            Title = title,
            Detail = detail,
            Instance = instance
        };

        var options = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
        await context.Response.WriteAsync(JsonSerializer.Serialize(problem, options));
    }
}
