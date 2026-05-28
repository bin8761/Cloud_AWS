using System.Windows;
using System.Windows.Input;
using CloudCMS.Client.Services;
using CloudCMS.Client.ViewModels;

namespace CloudCMS.Client;

public partial class MainWindow : Window
{
    private readonly MainViewModel _viewModel;

    private static readonly string ServerUrl =
        Environment.GetEnvironmentVariable("CLOUDCMS_SERVER_URL") ?? "http://localhost:3001";
    private static readonly string ComputerId =
        Environment.GetEnvironmentVariable("CLOUDCMS_COMPUTER_ID") ?? "replace-computer-id";
    private static readonly string DeviceToken =
        Environment.GetEnvironmentVariable("CLOUDCMS_DEVICE_TOKEN") ?? "replace-device-token";
    private static readonly bool EnableDevEscapeKeys = true;

    public MainWindow()
    {
        InitializeComponent();

        var stateMachine = new LockStateMachine();
        var realtime = new RealtimeClientService(ServerUrl, ComputerId, DeviceToken);
        _viewModel = new MainViewModel(stateMachine, realtime);
        DataContext = _viewModel;

        Loaded += async (_, _) =>
        {
            try
            {
                await _viewModel.StartAsync();
            }
            catch (Exception ex)
            {
                MessageBox.Show(ex.ToString(), "Realtime connect failed");
            }
        };
    }

    private void Window_KeyDown(object sender, KeyEventArgs e)
    {
        if (!EnableDevEscapeKeys)
        {
            return;
        }

        if (e.Key == Key.Escape)
        {
            WindowState = WindowState.Minimized;
            e.Handled = true;
        }

        if (e.Key == Key.F12)
        {
            Topmost = !Topmost;
            e.Handled = true;
        }
    }
}
