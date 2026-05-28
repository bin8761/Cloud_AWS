using CloudCMS.Client.Models;
using System.Text.Json.Serialization;

namespace CloudCMS.Client.Services;

public sealed class RealtimeClientService
{
    private SocketIOClient.SocketIO? _socket;
    private readonly string _serverUrl;
    private readonly string _deviceToken;
    private readonly string _computerId;

    public event Action<ControlCommand>? CommandReceived;
    public event Action<string>? StatusChanged;

    public RealtimeClientService(string serverUrl, string computerId, string deviceToken)
    {
        _serverUrl = serverUrl;
        _computerId = computerId;
        _deviceToken = deviceToken;
    }

    public async Task ConnectAsync()
    {
        if (_socket is not null)
        {
            StatusChanged?.Invoke("Realtime connecting...");
            await _socket.ConnectAsync();
            StatusChanged?.Invoke("Realtime connected");
            return;
        }

        _socket = new SocketIOClient.SocketIO(new Uri(_serverUrl), new SocketIOClient.SocketIOOptions
        {
            Reconnection = true,
            ReconnectionAttempts = 30,
            Auth = new Dictionary<string, string>
            {
                ["clientType"] = "computer",
                ["computerId"] = _computerId,
                ["deviceToken"] = _deviceToken,
            }
        });

        _socket.On("computer:control", (response) =>
        {
            StatusChanged?.Invoke("Command received");
            var payload = response.GetValue<ControlPayload>(0);
            if (payload is null)
            {
                StatusChanged?.Invoke("Command ignored: empty payload");
                return Task.CompletedTask;
            }

            if (!string.Equals(payload.ComputerId, _computerId, StringComparison.Ordinal))
            {
                StatusChanged?.Invoke("Command ignored: computer mismatch");
                return Task.CompletedTask;
            }

            if (!DateTimeOffset.TryParse(payload.SentAt, out var sentAt))
            {
                sentAt = DateTimeOffset.UtcNow;
            }

            CommandReceived?.Invoke(new ControlCommand(
                payload.TenantId,
                payload.ComputerId,
                payload.Action,
                payload.Mode,
                payload.DurationMinutes,
                sentAt));

            return Task.CompletedTask;
        });

        StatusChanged?.Invoke("Realtime connecting...");
        await _socket.ConnectAsync();
        StatusChanged?.Invoke("Realtime connected");
    }

    public Task DisconnectAsync() => _socket?.DisconnectAsync() ?? Task.CompletedTask;

    private sealed record ControlPayload(
        [property: JsonPropertyName("tenantId")] string TenantId,
        [property: JsonPropertyName("computerId")] string ComputerId,
        [property: JsonPropertyName("action")] string Action,
        [property: JsonPropertyName("mode")] string? Mode,
        [property: JsonPropertyName("durationMinutes")] int? DurationMinutes,
        [property: JsonPropertyName("sentAt")] string SentAt
    );
}
