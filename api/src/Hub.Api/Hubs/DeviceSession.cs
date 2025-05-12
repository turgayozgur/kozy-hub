namespace Hub.Api.Hubs;

internal class DeviceSession
{
    public required string Name { get; set; }
    public required string ConnectionId { get; set; }
    public object Payload { get; set; } = new();
}
