namespace CloudCMS.Client.Models;

public enum LockState
{
    Locked,
    UnlockedTimed,
    UnlockedFree,
}

public sealed record ControlCommand(
    string TenantId,
    string ComputerId,
    string Action,
    string? Mode,
    int? DurationMinutes,
    DateTimeOffset SentAt
);
