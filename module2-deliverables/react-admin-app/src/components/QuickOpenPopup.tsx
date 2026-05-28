import { useMemo, useState } from "react";
import {
  buildFreePayload,
  buildLockPayload,
  buildTimedPayload,
} from "../realtime/controlPayload";
import { RealtimeAdminClient } from "../realtime/realtimeAdminClient";

type Props = {
  computerId: string;
  serverUrl: string;
  accessToken: string;
};

export function QuickOpenPopup({ computerId, serverUrl, accessToken }: Props) {
  const client = useMemo(
    () => new RealtimeAdminClient(serverUrl, accessToken),
    [serverUrl, accessToken],
  );

  const [mode, setMode] = useState<"timed" | "free">("timed");
  const [hours, setHours] = useState<string>("1");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>("");

  const onUnlock = async () => {
    setPending(true);
    setMessage("");

    try {
      const payload =
        mode === "free"
          ? buildFreePayload(computerId)
          : buildTimedPayload(computerId, Number(hours));

      const ack = await client.emitComputerControl(payload);
      if (ack.success) {
        setMessage("Sent unlock command successfully.");
      } else {
        setMessage(`Failed: ${ack.error.code} - ${ack.error.message}`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unexpected error");
    } finally {
      setPending(false);
    }
  };

  const onLockNow = async () => {
    setPending(true);
    setMessage("");
    try {
      const ack = await client.emitComputerControl(buildLockPayload(computerId));
      if (ack.success) {
        setMessage("Sent lock command successfully.");
      } else {
        setMessage(`Failed: ${ack.error.code} - ${ack.error.message}`);
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <div style={{ border: "1px solid #ddd", padding: 16, borderRadius: 8 }}>
      <h3>Mo may nhanh</h3>
      <p>Computer: {computerId}</p>

      <label>
        Mode:
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as "timed" | "free")}
          disabled={pending}
        >
          <option value="timed">Timed</option>
          <option value="free">Free</option>
        </select>
      </label>

      {mode === "timed" ? (
        <label style={{ display: "block", marginTop: 12 }}>
          Hours:
          <input
            type="number"
            min="0.1"
            max="24"
            step="0.1"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            disabled={pending}
          />
        </label>
      ) : null}

      <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
        <button onClick={onUnlock} disabled={pending}>
          Unlock
        </button>
        <button onClick={onLockNow} disabled={pending}>
          Lock Now
        </button>
      </div>

      {message ? <p style={{ marginTop: 12 }}>{message}</p> : null}
    </div>
  );
}
