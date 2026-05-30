# CloudCMS Desktop Heartbeat Client

Electron + TypeScript desktop app that sends `client:heartbeat` events to the existing CloudCMS Socket.IO backend.

## Spec Reference

Primary spec: `SPEC.md`

## Key Constraints

- The app is a desktop app, but no longer required to be WPF/.NET.
- Use Socket.IO auth payload with `clientType: "computer"`, `computerId`, and `deviceToken`.
- Emit `client:heartbeat` every 10 seconds while connected.
- Never log or expose raw `deviceToken` outside the config input and Socket.IO auth payload.
- Store config at `%AppData%/CloudCMS/heartbeat-client.json` for MVP.
- Keep lockscreen, tray mode, installer, and token encryption out of MVP unless explicitly requested.

## Commands

Commands depend on the implementation scaffold selected in the next phase. Expected baseline:

```powershell
cd desktop-client/heartbeat-client
npm install
npm run dev
npm run build
```

## Current Status

Check `SPEC.md` -> Development Phases.
