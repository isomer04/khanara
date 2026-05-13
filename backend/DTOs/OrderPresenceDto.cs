namespace Khanara.API.DTOs;

public class OrderPresenceDto
{
    public int OrderId { get; set; }
    public bool CookOnline { get; set; }
    public bool EaterOnline { get; set; }
}
