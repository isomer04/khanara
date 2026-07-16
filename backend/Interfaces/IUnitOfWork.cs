namespace Khanara.API.Interfaces;

public interface IUnitOfWork
{
    IMessageRepository MessageRepository { get; }
    ICookRepository CookRepository { get; }
    IDishRepository DishRepository { get; }
    IOrderRepository OrderRepository { get; }
    IReviewRepository ReviewRepository { get; }
    IFavoriteRepository FavoriteRepository { get; }
    IDiscoveryRepository DiscoveryRepository { get; }
    ICartRepository CartRepository { get; }
    Task<bool> Complete();
    bool HasChanges();
}
