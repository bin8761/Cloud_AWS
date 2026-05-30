import { useEffect, useMemo, useState } from "react";

import { DEFAULT_HEARTBEAT_CLIENT_CONFIG } from "../shared/realtimeProtocol";
import type { HeartbeatClientConfig } from "../shared/types";
import { HEARTBEAT_STATES } from "../shared/types";
import { heartbeatService } from "./heartbeatService";

type ValidationErrors = Partial<Record<keyof HeartbeatClientConfig, string>>;

const formatStatusTimestamp = (value: string | null): string => value ?? "-";

const validateConfig = (config: HeartbeatClientConfig): ValidationErrors => {
  const errors: ValidationErrors = {};

  if (!config.serverUrl.trim()) {
    errors.serverUrl = "Server URL is required.";
  }

  if (!config.computerId.trim()) {
    errors.computerId = "Computer ID is required.";
  }

  if (!config.deviceToken.trim()) {
    errors.deviceToken = "Device Token is required.";
  }

  return errors;
};

export const App = (): JSX.Element => {
  const [config, setConfig] = useState<HeartbeatClientConfig>(DEFAULT_HEARTBEAT_CLIENT_CONFIG);
  const [status, setStatus] = useState(() => heartbeatService.getSnapshot());
  const [isSaving, setIsSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [formMessage, setFormMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void window.heartbeatConfig.loadConfig().then((loadedConfig) => {
      if (mounted) {
        setConfig(loadedConfig);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const unsubscribe = heartbeatService.subscribe((snapshot) => {
      setStatus(snapshot);
    });

    const stopHeartbeatForShutdown = () => {
      heartbeatService.disconnect();
    };
    window.addEventListener("beforeunload", stopHeartbeatForShutdown);
    window.addEventListener("unload", stopHeartbeatForShutdown);

    return () => {
      window.removeEventListener("beforeunload", stopHeartbeatForShutdown);
      window.removeEventListener("unload", stopHeartbeatForShutdown);
      unsubscribe();
      heartbeatService.disconnect();
    };
  }, []);

  const stateClassName = useMemo(() => {
    if (status.state === HEARTBEAT_STATES.connected) {
      return "status-chip status-chip--ok";
    }

    if (status.state === HEARTBEAT_STATES.error) {
      return "status-chip status-chip--error";
    }

    return "status-chip";
  }, [status.state]);

  const handleFieldChange =
    (key: keyof HeartbeatClientConfig) => (event: React.ChangeEvent<HTMLInputElement>) => {
      setConfig((previousConfig) => ({
        ...previousConfig,
        [key]: event.target.value
      }));

      if (validationErrors[key]) {
        setValidationErrors((previousErrors) => ({ ...previousErrors, [key]: undefined }));
      }
      setFormMessage(null);
    };

  const handleSave = async (): Promise<void> => {
    setIsSaving(true);
    setFormMessage(null);

    try {
      const saved = await window.heartbeatConfig.saveConfig(config);
      setConfig(saved);
      setFormMessage("Configuration saved.");
    } catch {
      setFormMessage("Cannot save configuration right now.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleConnect = (): void => {
    const errors = validateConfig(config);
    setValidationErrors(errors);
    setFormMessage(null);

    if (Object.keys(errors).length > 0) {
      return;
    }

    heartbeatService.connect(config);
  };

  const handleDisconnect = (): void => {
    heartbeatService.disconnect();
  };

  const isConnecting = status.state === HEARTBEAT_STATES.connecting;
  const isDisconnected = status.state === HEARTBEAT_STATES.disconnected;

  return (
    <main className="app-shell" aria-label="CloudCMS Heartbeat Client">
      <section className="utility-panel" aria-labelledby="heartbeat-client-title">
        <header className="utility-header">
          <p className="eyebrow">Realtime Utility</p>
          <h1 id="heartbeat-client-title">CloudCMS Heartbeat Client</h1>
          <p className="lede">Use this desktop utility to maintain realtime presence for a registered computer.</p>
        </header>

        <form className="config-form" onSubmit={(event) => event.preventDefault()}>
          <label className="field-row" htmlFor="server-url-input">
            <span className="field-label">Server URL</span>
            <input
              id="server-url-input"
              name="serverUrl"
              className="field-input"
              type="text"
              value={config.serverUrl}
              onChange={handleFieldChange("serverUrl")}
              autoComplete="off"
              aria-invalid={Boolean(validationErrors.serverUrl)}
            />
            {validationErrors.serverUrl ? <span className="field-error">{validationErrors.serverUrl}</span> : null}
          </label>

          <label className="field-row" htmlFor="computer-id-input">
            <span className="field-label">Computer ID</span>
            <input
              id="computer-id-input"
              name="computerId"
              className="field-input"
              type="text"
              value={config.computerId}
              onChange={handleFieldChange("computerId")}
              autoComplete="off"
              aria-invalid={Boolean(validationErrors.computerId)}
            />
            {validationErrors.computerId ? <span className="field-error">{validationErrors.computerId}</span> : null}
          </label>

          <label className="field-row" htmlFor="device-token-input">
            <span className="field-label">Device Token</span>
            <input
              id="device-token-input"
              name="deviceToken"
              className="field-input"
              type="password"
              value={config.deviceToken}
              onChange={handleFieldChange("deviceToken")}
              autoComplete="off"
              aria-invalid={Boolean(validationErrors.deviceToken)}
            />
            {validationErrors.deviceToken ? <span className="field-error">{validationErrors.deviceToken}</span> : null}
          </label>

          <div className="actions-row" aria-label="Client actions">
            <button
              type="button"
              className="action-button action-button--neutral"
              onClick={() => {
                void handleSave();
              }}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              className="action-button action-button--primary"
              onClick={handleConnect}
              disabled={isConnecting}
            >
              Connect
            </button>
            <button
              type="button"
              className="action-button action-button--danger"
              onClick={handleDisconnect}
              disabled={isDisconnected}
            >
              Disconnect
            </button>
          </div>

          {formMessage ? <p className="form-message">{formMessage}</p> : null}
        </form>

        <section className="status-grid" aria-label="Heartbeat status panel">
          <div className="status-item">
            <p className="status-label">Connection state</p>
            <p className={stateClassName}>{status.state}</p>
          </div>

          <div className="status-item">
            <p className="status-label">Last heartbeat sent</p>
            <p className="status-value">{formatStatusTimestamp(status.lastHeartbeatSentAt)}</p>
          </div>

          <div className="status-item">
            <p className="status-label">Last acknowledgement</p>
            <p className="status-value">{formatStatusTimestamp(status.lastAckAt)}</p>
          </div>

          <div className="status-item">
            <p className="status-label">Error message</p>
            <p className="status-value">{status.lastError ?? "No active errors"}</p>
          </div>
        </section>
      </section>
    </main>
  );
};

