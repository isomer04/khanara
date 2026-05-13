namespace Khanara.API.Entities;

public class DishPhoto
{
    public int Id { get; set; }
    public required string Url { get; set; }
    public string? PublicId { get; set; }
    public bool IsMain { get; set; }
    public int DishId { get; set; }
    public Dish Dish { get; set; } = null!;
}
