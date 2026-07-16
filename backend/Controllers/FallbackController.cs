using Microsoft.AspNetCore.Mvc;

namespace API.Controllers;

public class FallbackController : Controller
{
    private readonly IWebHostEnvironment _env;

    public FallbackController(IWebHostEnvironment env)
    {
        _env = env;
    }

    public IActionResult Index()
    {
        return PhysicalFile(Path.Combine(_env.WebRootPath, "index.html"), "text/html");
    }
}
