using Khanara.API.DTOs;
using Khanara.API.Entities;
using Khanara.API.Extensions;
using Khanara.API.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Khanara.API.Data;

public class MessageRepository(AppDbContext context) : IMessageRepository
{
    public void AddMessage(Message message) => context.Messages.Add(message);

    public async Task<MessageDto?> GetMessageByIdAsync(int messageId)
    {
        return await context.Messages
            .Where(m => m.Id == messageId)
            .Select(MessageExtensions.ToDtoProjection())
            .FirstOrDefaultAsync();
    }

    public async Task<List<MessageDto>> GetOrderMessagesAsync(int orderId)
    {
        return await context.Messages
            .Where(m => m.OrderId == orderId)
            .OrderBy(m => m.SentAt)
            .Select(MessageExtensions.ToDtoProjection())
            .ToListAsync();
    }
}
