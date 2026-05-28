using CloudCMS.Client.Models;

namespace CloudCMS.Client.Services;

public sealed class LockStateMachine
{
    public LockState CurrentState { get; private set; } = LockState.Locked;
    public DateTimeOffset? EndsAtUtc { get; private set; }

    public event Action<LockState>? StateChanged;

    public void Apply(ControlCommand command)
    {
        if (command.Action == "lock")
        {
            SetState(LockState.Locked, null);
            return;
        }

        if (command.Action != "unlock")
        {
            return;
        }

        if (string.Equals(command.Mode, "free", StringComparison.OrdinalIgnoreCase))
        {
            SetState(LockState.UnlockedFree, null);
            return;
        }

        if (string.Equals(command.Mode, "timed", StringComparison.OrdinalIgnoreCase) &&
            command.DurationMinutes is > 0)
        {
            var endsAt = DateTimeOffset.UtcNow.AddMinutes(command.DurationMinutes.Value);
            SetState(LockState.UnlockedTimed, endsAt);
        }
    }

    public void Tick()
    {
        if (CurrentState != LockState.UnlockedTimed || EndsAtUtc is null)
        {
            return;
        }

        if (DateTimeOffset.UtcNow >= EndsAtUtc.Value)
        {
            SetState(LockState.Locked, null);
        }
    }

    private void SetState(LockState state, DateTimeOffset? endsAtUtc)
    {
        CurrentState = state;
        EndsAtUtc = endsAtUtc;
        StateChanged?.Invoke(state);
    }
}
