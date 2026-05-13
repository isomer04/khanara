namespace Khanara.API.Entities;

public class OrderItem
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public int DishId { get; set; }
    public int Quantity { get; set; }
    public decimal UnitPriceSnapshot { get; set; }

    public Order Order { get; set; } = null!;
    public Dish Dish { get; set; } = null!;
}
