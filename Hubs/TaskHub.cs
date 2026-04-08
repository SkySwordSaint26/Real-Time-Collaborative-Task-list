using Microsoft.AspNetCore.SignalR;
using Project.DTOs.Item;

namespace Project.Hubs
{
    public class TaskHub : Hub
    {
        // Broadcast to all clients
        public async Task SendTaskUpdate(string action, ItemDto item)
        {
            await Clients.All.SendAsync("ReceiveTaskUpdate", action, item);
        }

        // Potential future: JoinGroup(string boardId)
    }
}
