# Person 2 Deliverables (Starter Kit)

This folder gives you starter code for your scope only:

1. `wpf-client/CloudCMS.Client`
   - `Models/LockModels.cs`
   - `Services/LockStateMachine.cs`
   - `Services/RealtimeClientService.cs`
   - `ViewModels/MainViewModel.cs`

2. `react-admin/src`
   - `components/QuickOpenPopup.tsx`
   - `realtime/controlPayload.ts`
   - `realtime/realtimeAdminClient.ts`

## Notes

1. WPF sample expects `SocketIOClient` NuGet package.
2. React sample expects `socket.io-client` package.
3. Event names and payloads match backend contract:
   - emit: `admin:computer-control`
   - receive: `computer:control`
4. Do not commit real secrets in source code.

## WPF local configuration

Set these environment variables before running the WPF demo:

```powershell
$env:CLOUDCMS_SERVER_URL="http://localhost:3001"
$env:CLOUDCMS_COMPUTER_ID="<computer-id>"
$env:CLOUDCMS_DEVICE_TOKEN="<device-token>"
dotnet run --no-build
```

The application falls back to placeholders when the variables are missing, so a real client will not connect until the values are provided locally.
