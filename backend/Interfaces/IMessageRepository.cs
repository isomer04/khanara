using Khanara.API.DTOs;
using Khanara.API.Entities;

namespace Khanara.API.Interfaces;

public interface IMessageRepository
{
    void AddMessage(Message message);
    Task<MessageDto?> GetMessageByIdAsync(int messageId);
    Task<List<MessageDto>> GetOrderMessagesAsync(int orderId);
}
