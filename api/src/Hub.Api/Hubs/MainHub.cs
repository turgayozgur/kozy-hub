using Microsoft.AspNetCore.SignalR;
using System.Collections.Concurrent;

namespace Hub.Api.Hubs;

public class MainHub : Microsoft.AspNetCore.SignalR.Hub
{
    private const string DeviceContextKeyName = "Key";
    
    private readonly ILogger<MainHub> _logger;

    private static readonly ConcurrentDictionary<string, DeviceSession> DeviceSessions = new();

    public MainHub(ILogger<MainHub> logger)
    {
        _logger = logger;
    }

    private static string GetUserDeviceSubscriptionGroup(string key) => $"user_device_{key}";

    public override async Task OnConnectedAsync()
    {
        _logger.LogInformation("Client connected: {ConnectionId}. User: {User}", Context.ConnectionId,
            Context.User?.Identity?.Name ?? "N/A");
        
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        _logger.LogInformation("Client disconnected: {ConnectionId}. Exception: {Exception}", Context.ConnectionId,
            exception?.Message);

        if (Context.Items.TryGetValue(DeviceContextKeyName, out var keyObj) &&
            keyObj is string key)
        {
            if (DeviceSessions.TryRemove(key, out var session))
            {
                await Clients.Group(GetUserDeviceSubscriptionGroup(key))
                    .SendAsync("DeviceDisconnected", key, session.Name, true);
                
                _logger.LogInformation(
                    "Desktop client session removed for Device: {Key} due to disconnect of {ConnectionId}",
                    key, Context.ConnectionId);
            }
        }

        await base.OnDisconnectedAsync(exception);
    }

    public async Task InitializeDeviceSession(string key, string name, object payload)
    {
        if (string.IsNullOrEmpty(key))
        {
            _logger.LogWarning("Device {Key} session initialization failed. Invalid key. ConnId: {ConnectionId}", key,
                Context.ConnectionId);
            
            await Clients.Caller.SendAsync("DesktopSessionInitResult", key, name, false);
            
            Context.Abort();
            
            return;
        }
        
        Context.Items[DeviceContextKeyName] = key;

        var session = new DeviceSession
        {
            Name = name,
            ConnectionId = Context.ConnectionId,
            Payload = payload
        };

        DeviceSessions.AddOrUpdate(key, session, (_, _) => session);

        await Clients.Group(GetUserDeviceSubscriptionGroup(key)).SendAsync("DeviceConnected", key, name, payload);
        
        await Clients.Caller.SendAsync("DeviceSessionInitResult", key, name, true);
    }

    public async Task SubscribeToDevices(string keys)
    {
        var items = keys.Split(',');
        
        if (items.Length == 0) return;

        foreach (var key in items)
        {
            if (DeviceSessions.TryGetValue(key, out var session))
            {
                await Clients.Caller.SendAsync("DeviceConnected", key, session.Name, session.Payload);
            }

            var groupName = GetUserDeviceSubscriptionGroup(key);
        
            await Groups.AddToGroupAsync(Context.ConnectionId, groupName);
        }
    }

    public async Task SendToDevice(string key, string name, object payload)
    {
        if (!DeviceSessions.TryGetValue(key, out var session))
        {
            await Clients.Caller.SendAsync("SendResult", key, name, false);
            return;
        }

        await Clients.Client(session.ConnectionId).SendAsync("ReceiveFromUser", key, name, payload, Context.ConnectionId);
        
        await Clients.Caller.SendAsync("SendResult", key, name, true);
    }

    public async Task SendResponseFromDevice(string initiatorWebConnectionId, string originalName,
        object payload)
    {
        await Clients.Client(initiatorWebConnectionId).SendAsync("ReceiveResponseFromDevice",
            Context.Items[DeviceContextKeyName],
            originalName, payload);
    }

    public async Task SendToUsers(string name, object payload)
    {
        var key = (string)Context.Items[DeviceContextKeyName]!;
        
        var groupName = GetUserDeviceSubscriptionGroup(key);

        await Clients.Group(groupName).SendAsync("ReceiveFromDevice", key, name, payload);
    }
}
