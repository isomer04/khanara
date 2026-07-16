namespace Khanara.API.DTOs;

public class DishPhotoDto
{
    public int Id { get; set; }
    public required string Url { get; set; }
    public bool IsMain { get; set; }
}
