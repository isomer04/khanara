using System.Linq.Expressions;
using Khanara.API.DTOs;
using Khanara.API.Entities;

namespace Khanara.API.Extensions;

public static class MessageExtensions
{
    public static MessageDto ToDto(this Message m) => new()
    {
        Id = m.Id,
        OrderId = m.OrderId,
        SenderId = m.SenderId,
        SenderDisplayName = m.Sender.DisplayName,
        Content = m.Content,
        SentAt = m.SentAt
    };

    public static Expression<Func<Message, MessageDto>> ToDtoProjection() =>
        m => new MessageDto
        {
            Id = m.Id,
            OrderId = m.OrderId,
            SenderId = m.SenderId,
            SenderDisplayName = m.Sender.DisplayName,
            Content = m.Content,
            SentAt = m.SentAt
        };
}
