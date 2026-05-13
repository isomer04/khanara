using Khanara.API.Entities;

namespace Khanara.API.Tests.Builders;

public class OrderBuilder
{
    private string _eaterUserId = string.Empty;
    private int _cookProfileId;
    private OrderStatus _status = OrderStatus.Pending;
    private PaymentMethod _paymentMethod = PaymentMethod.Cash;
    private PaymentStatus _paymentStatus = PaymentStatus.Pending;
    private decimal _totalAmount = 50.00m;
    private FulfillmentType _fulfillmentType = FulfillmentType.Pickup;
    private List<OrderItem> _items = new();

    public OrderBuilder ForEater(string userId)
    {
        _eaterUserId = userId;
        return this;
    }

    public OrderBuilder ForCook(int cookProfileId)
    {
        _cookProfileId = cookProfileId;
        return this;
    }

    public OrderBuilder WithStatus(OrderStatus status)
    {
        _status = status;
        return this;
    }

    public OrderBuilder WithPaymentMethod(PaymentMethod method)
    {
        _paymentMethod = method;
        return this;
    }

    public OrderBuilder Paid()
    {
        _paymentStatus = PaymentStatus.Paid;
        return this;
    }

    public OrderBuilder WithFulfillmentType(FulfillmentType fulfillmentType)
    {
        _fulfillmentType = fulfillmentType;
        return this;
    }

    public OrderBuilder WithTotalAmount(decimal amount)
    {
        _totalAmount = amount;
        return this;
    }

    public OrderBuilder WithItem(int dishId, int quantity, decimal unitPrice)
    {
        _items.Add(new OrderItem
        {
            DishId = dishId,
            Quantity = quantity,
            UnitPriceSnapshot = unitPrice
        });
        return this;
    }

    public Order Build()
    {
        return new Order
        {
            EaterUserId = _eaterUserId,
            CookProfileId = _cookProfileId,
            Status = _status,
            PaymentMethod = _paymentMethod,
            PaymentStatus = _paymentStatus,
            TotalAmount = _totalAmount,
            FulfillmentType = _fulfillmentType,
            Items = new List<OrderItem>(_items) // Create defensive copy to prevent shared mutation
        };
    }
}
