using System.ComponentModel;
using System.Runtime.CompilerServices;
using CloudCMS.Client.Models;
using CloudCMS.Client.Services;
using System.Windows.Threading;

namespace CloudCMS.Client.ViewModels;

public sealed class MainViewModel : INotifyPropertyChanged
{
    private readonly LockStateMachine _stateMachine;
    private readonly RealtimeClientService _realtime;
    private readonly DispatcherTimer _timer;
    private readonly Dispatcher _dispatcher;

    private LockState _state;
    private string _statusText = "Locked";
    private string _realtimeStatus = "Realtime idle";

    public event PropertyChangedEventHandler? PropertyChanged;

    public LockState State
    {
        get => _state;
        private set
        {
            _state = value;
            OnPropertyChanged();
            OnPropertyChanged(nameof(IsLocked));
        }
    }

    public bool IsLocked => State == LockState.Locked;

    public string StatusText
    {
        get => _statusText;
        private set
        {
            _statusText = value;
            OnPropertyChanged();
        }
    }

    public string RealtimeStatus
    {
        get => _realtimeStatus;
        private set
        {
            _realtimeStatus = value;
            OnPropertyChanged();
        }
    }

    public MainViewModel(LockStateMachine stateMachine, RealtimeClientService realtime)
    {
        _stateMachine = stateMachine;
        _realtime = realtime;
        _dispatcher = Dispatcher.CurrentDispatcher;
        _stateMachine.StateChanged += OnStateChanged;
        _realtime.StatusChanged += (status) =>
            _dispatcher.Invoke(() => RealtimeStatus = status);
        _realtime.CommandReceived += (cmd) =>
        {
            _dispatcher.Invoke(() =>
            {
                RealtimeStatus = $"Applying command: {cmd.Action}";
                _stateMachine.Apply(cmd);
            });
        };

        _timer = new DispatcherTimer
        {
            Interval = TimeSpan.FromSeconds(1),
        };
        _timer.Tick += (_, _) =>
        {
            _stateMachine.Tick();
            UpdateStatusText();
        };
        _timer.Start();

        State = LockState.Locked;
    }

    public async Task StartAsync()
    {
        RealtimeStatus = "Realtime starting...";
        await _realtime.ConnectAsync();
    }

    private void OnStateChanged(LockState state)
    {
        State = state;
        UpdateStatusText();
    }

    private void UpdateStatusText()
    {
        if (State == LockState.Locked)
        {
            StatusText = "Locked";
            return;
        }

        if (State == LockState.UnlockedFree)
        {
            StatusText = "Free session";
            return;
        }

        var endsAt = _stateMachine.EndsAtUtc;
        if (endsAt is null)
        {
            StatusText = "Timed session";
            return;
        }

        var remaining = endsAt.Value - DateTimeOffset.UtcNow;
        if (remaining < TimeSpan.Zero)
        {
            remaining = TimeSpan.Zero;
        }

        StatusText = $"Remaining: {remaining:hh\\:mm\\:ss}";
    }

    private void OnPropertyChanged([CallerMemberName] string? name = null)
        => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
}
