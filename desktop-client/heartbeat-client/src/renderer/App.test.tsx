/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HEARTBEAT_STATES, createHeartbeatStatus } from "../shared/types";
import { App } from "./App";

const heartbeatServiceMocks = vi.hoisted(() => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  subscribe: vi.fn(),
  getSnapshot: vi.fn()
}));

vi.mock("./heartbeatService", () => ({
  heartbeatService: {
    connect: heartbeatServiceMocks.connect,
    disconnect: heartbeatServiceMocks.disconnect,
    subscribe: heartbeatServiceMocks.subscribe,
    getSnapshot: heartbeatServiceMocks.getSnapshot
  }
}));

describe("App", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    heartbeatServiceMocks.getSnapshot.mockReturnValue(createHeartbeatStatus(HEARTBEAT_STATES.disconnected));
    heartbeatServiceMocks.subscribe.mockImplementation((listener: (snapshot: ReturnType<typeof createHeartbeatStatus>) => void) => {
      listener(createHeartbeatStatus(HEARTBEAT_STATES.disconnected));
      return () => undefined;
    });

    window.heartbeatConfig = {
      loadConfig: vi.fn().mockResolvedValue({
        serverUrl: "http://localhost:3000",
        computerId: "",
        deviceToken: ""
      }),
      saveConfig: vi.fn().mockImplementation(async (config) => config)
    };
  });

  it("renders required labels and action buttons", async () => {
    render(<App />);

    expect(await screen.findByLabelText("Server URL")).toBeTruthy();
    expect(screen.getByLabelText("Computer ID")).toBeTruthy();
    expect(screen.getByLabelText("Device Token")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Connect" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Disconnect" })).toBeTruthy();
  });

  it("renders validation errors when connecting with empty required fields", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: "CloudCMS Heartbeat Client" });

    fireEvent.change(screen.getByLabelText("Server URL"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Computer ID"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Device Token"), { target: { value: "" } });

    fireEvent.click(screen.getByRole("button", { name: "Connect" }));

    expect(screen.getByText("Server URL is required.")).toBeTruthy();
    expect(screen.getByText("Computer ID is required.")).toBeTruthy();
    expect(screen.getByText("Device Token is required.")).toBeTruthy();
    expect(heartbeatServiceMocks.connect).not.toHaveBeenCalled();
  });

  it("calls saveConfig with form data when save is clicked", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: "CloudCMS Heartbeat Client" });

    fireEvent.change(screen.getByLabelText("Server URL"), { target: { value: "http://127.0.0.1:3000" } });
    fireEvent.change(screen.getByLabelText("Computer ID"), { target: { value: "pc-01" } });
    fireEvent.change(screen.getByLabelText("Device Token"), { target: { value: "token-01" } });

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(window.heartbeatConfig.saveConfig).toHaveBeenCalledWith({
        serverUrl: "http://127.0.0.1:3000",
        computerId: "pc-01",
        deviceToken: "token-01"
      });
    });
  });

  it("updates connect and disconnect button states from heartbeat snapshots", async () => {
    heartbeatServiceMocks.subscribe.mockImplementation((listener: (snapshot: ReturnType<typeof createHeartbeatStatus>) => void) => {
      listener(createHeartbeatStatus(HEARTBEAT_STATES.connecting));
      return () => undefined;
    });

    render(<App />);

    const connectButton = await screen.findByRole("button", { name: "Connect" });
    const disconnectButton = screen.getByRole("button", { name: "Disconnect" });

    expect(connectButton.hasAttribute("disabled")).toBe(true);
    expect(disconnectButton.hasAttribute("disabled")).toBe(false);
  });

  it("loads config again when app is remounted (restart behavior)", async () => {
    const loadConfigMock = vi.fn().mockResolvedValue({
      serverUrl: "http://localhost:3000",
      computerId: "pc-remount",
      deviceToken: "token-remount"
    });

    window.heartbeatConfig = {
      loadConfig: loadConfigMock,
      saveConfig: vi.fn().mockImplementation(async (config) => config)
    };

    const firstRender = render(<App />);
    await screen.findByDisplayValue("pc-remount");
    firstRender.unmount();

    render(<App />);
    await screen.findByDisplayValue("pc-remount");

    expect(loadConfigMock).toHaveBeenCalledTimes(2);
  });
});
