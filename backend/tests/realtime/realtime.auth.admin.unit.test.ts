import type { Socket } from "socket.io";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { verifyAccessTokenMock } = vi.hoisted(() => ({
  verifyAccessTokenMock: vi.fn(),
}));

vi.mock("../../src/shared/prisma/prisma.client", () => ({
  prisma: {
    computer: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("../../src/modules/computers/computers.service", () => ({
  hashDeviceToken: vi.fn(() => "mock-device-token-hash"),
}));

vi.mock("../../src/modules/auth/auth.tokens", () => ({
  authTokenService: {
    verifyAccessToken: verifyAccessTokenMock,
  },
}));

import { authenticateRealtimeAdminHandshake } from "../../src/modules/realtime/realtime.auth";

const createSocketWithAuth = (auth: unknown): Socket =>
  ({
    handshake: {
      auth,
    },
  }) as Socket;

describe("Realtime admin auth unit tests (Task 201-208)", () => {
  beforeEach(() => {
    verifyAccessTokenMock.mockReset();
  });

  it("Task 201: accepts valid shop_admin access token with tenant context", async () => {
    verifyAccessTokenMock.mockResolvedValue({
      sub: "user-shop-admin",
      tenantId: "tenant-a",
      role: "shop_admin",
      tokenType: "access",
    });

    const context = await authenticateRealtimeAdminHandshake(
      createSocketWithAuth({
        clientType: "admin",
        accessToken: "valid-shop-admin-token",
      })
    );

    expect(context).toEqual({
      clientType: "admin",
      userId: "user-shop-admin",
      tenantId: "tenant-a",
      role: "shop_admin",
    });
  });

  it("Task 202: accepts valid staff access token with tenant context", async () => {
    verifyAccessTokenMock.mockResolvedValue({
      sub: "user-staff",
      tenantId: "tenant-b",
      role: "staff",
      tokenType: "access",
    });

    const context = await authenticateRealtimeAdminHandshake(
      createSocketWithAuth({
        clientType: "admin",
        accessToken: "valid-staff-token",
      })
    );

    expect(context).toEqual({
      clientType: "admin",
      userId: "user-staff",
      tenantId: "tenant-b",
      role: "staff",
    });
  });

  it("Task 203: rejects missing token", async () => {
    await expect(
      authenticateRealtimeAdminHandshake(
        createSocketWithAuth({
          clientType: "admin",
        })
      )
    ).rejects.toThrow("Unauthorized realtime connection");

    expect(verifyAccessTokenMock).not.toHaveBeenCalled();
  });

  it("Task 204: rejects malformed token", async () => {
    verifyAccessTokenMock.mockRejectedValue(new Error("jwt malformed"));

    await expect(
      authenticateRealtimeAdminHandshake(
        createSocketWithAuth({
          clientType: "admin",
          accessToken: "malformed.token",
        })
      )
    ).rejects.toThrow("Unauthorized realtime connection");
  });

  it("Task 205: rejects expired token", async () => {
    verifyAccessTokenMock.mockRejectedValue(new Error("jwt expired"));

    await expect(
      authenticateRealtimeAdminHandshake(
        createSocketWithAuth({
          clientType: "admin",
          accessToken: "expired-token",
        })
      )
    ).rejects.toThrow("Unauthorized realtime connection");
  });

  it("Task 206: rejects refresh-token-type token", async () => {
    verifyAccessTokenMock.mockResolvedValue({
      sub: "user-refresh",
      tenantId: "tenant-c",
      role: "shop_admin",
      tokenType: "refresh",
    });

    await expect(
      authenticateRealtimeAdminHandshake(
        createSocketWithAuth({
          clientType: "admin",
          accessToken: "refresh-token",
        })
      )
    ).rejects.toThrow("Unauthorized realtime connection");
  });

  it("Task 207: rejects missing tenant context", async () => {
    verifyAccessTokenMock.mockResolvedValue({
      sub: "user-no-tenant",
      role: "shop_admin",
      tokenType: "access",
    });

    await expect(
      authenticateRealtimeAdminHandshake(
        createSocketWithAuth({
          clientType: "admin",
          accessToken: "token-missing-tenant",
        })
      )
    ).rejects.toThrow("Unauthorized realtime connection");
  });

  it("Task 208: rejects super_admin role", async () => {
    verifyAccessTokenMock.mockResolvedValue({
      sub: "user-super-admin",
      tenantId: "tenant-d",
      role: "super_admin",
      tokenType: "access",
    });

    await expect(
      authenticateRealtimeAdminHandshake(
        createSocketWithAuth({
          clientType: "admin",
          accessToken: "super-admin-token",
        })
      )
    ).rejects.toThrow("Unauthorized realtime connection");
  });
});
