import type { Response as SupertestResponse } from "supertest";
import request from "supertest";
import { describe, expect, it } from "vitest";

const apiBaseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:3000";
const liveApi = request(apiBaseUrl);

const createUniqueSuffix = (): string => {
  return `${Date.now()}_${Math.floor(Math.random() * 100_000)}`;
};

const createRegisterPayload = (): Record<string, string> => {
  const suffix = createUniqueSuffix();

  return {
    tenantName: `Live Tenant ${suffix}`,
    tenantCode: `LIVE_${suffix}`.toUpperCase(),
    adminFullName: `Live Admin ${suffix}`,
    adminEmail: `live-admin-${suffix}@example.com`,
    adminPassword: "Password1!",
  };
};

const assertErrorCode = (response: SupertestResponse, code: string): void => {
  expect(response.body.success).toBe(false);
  expect(response.body.error.code).toBe(code);
};

describe.sequential("Auth API live integration tests (real server)", () => {
  it("LIVE-01: health endpoint is reachable", async () => {
    const response = await liveApi.get("/health");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it("LIVE-02: register-tenant invalid payload returns VALIDATION_ERROR", async () => {
    const payload = createRegisterPayload();
    payload.adminPassword = "weak";

    const response = await liveApi.post("/api/auth/register-tenant").send(payload);

    expect(response.status).toBe(400);
    assertErrorCode(response, "VALIDATION_ERROR");
  });

  it("LIVE-03: login with unknown email returns UNAUTHORIZED", async () => {
    const suffix = createUniqueSuffix();
    const response = await liveApi.post("/api/auth/login").send({
      email: `missing-${suffix}@example.com`,
      password: "WrongPassword1!",
    });

    expect(response.status).toBe(401);
    assertErrorCode(response, "UNAUTHORIZED");
  });

  it("LIVE-04: me without token returns UNAUTHORIZED", async () => {
    const response = await liveApi.get("/api/auth/me");

    expect(response.status).toBe(401);
    assertErrorCode(response, "UNAUTHORIZED");
  });

  it("LIVE-05: refresh with invalid token returns UNAUTHORIZED", async () => {
    const response = await liveApi.post("/api/auth/refresh").send({
      refreshToken: `invalid-live-token-${createUniqueSuffix()}`,
    });

    expect(response.status).toBe(401);
    assertErrorCode(response, "UNAUTHORIZED");
  });

  it("LIVE-06: logout stays idempotent for unknown token", async () => {
    const response = await liveApi.post("/api/auth/logout").send({
      refreshToken: `unknown-live-token-${createUniqueSuffix()}`,
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual({ loggedOut: true });
  });
});

