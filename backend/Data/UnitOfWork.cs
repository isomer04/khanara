using Khanara.API.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Khanara.API.Data;

public class UnitOfWork(AppDbContext context) : IUnitOfWork
{
    private IMessageRepository? _messageRepository;
    private ICookRepository? _cookRepository;
    private IDishRepository? _dishRepository;
    private IOrderRepository? _orderRepository;
    private IReviewRepository? _reviewRepository;
    private IFavoriteRepository? _favoriteRepository;
    private IDiscoveryRepository? _discoveryRepository;
    private ICartRepository? _cartRepository;

    public IMessageRepository MessageRepository => _messageRepository
        ??= new MessageRepository(context);

    public ICookRepository CookRepository => _cookRepository
        ??= new CookRepository(context);

    public IDishRepository DishRepository => _dishRepository
        ??= new DishRepository(context);

    public IOrderRepository OrderRepository => _orderRepository
        ??= new OrderRepository(context);

    public IReviewRepository ReviewRepository => _reviewRepository
        ??= new ReviewRepository(context);

    public IFavoriteRepository FavoriteRepository => _favoriteRepository
        ??= new FavoriteRepository(context);

    public IDiscoveryRepository DiscoveryRepository => _discoveryRepository
        ??= new DiscoveryRepository(context);

    public ICartRepository CartRepository => _cartRepository
        ??= new CartRepository(context);

    public async Task<bool> Complete()
    {
        return await context.SaveChangesAsync() > 0;
    }

    public bool HasChanges()
    {
        return context.ChangeTracker.HasChanges();
    }
}
