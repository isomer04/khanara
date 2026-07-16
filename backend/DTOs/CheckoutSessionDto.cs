namespace Khanara.API.DTOs;

public class CreateCheckoutSessionDto
{
    public int OrderId { get; set; }
}

public class CheckoutSessionResponseDto
{
    public string SessionUrl { get; set; } = string.Empty;
}
