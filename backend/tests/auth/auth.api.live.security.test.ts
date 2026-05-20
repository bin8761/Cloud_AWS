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
    tenantName: `Live Security Tenant ${suffix}`,
    tenantCode: `LIVESEC_${suffix}`.toUpperCase(),
    adminFullName: `Live Security Admin ${suffix}`,
    adminEmail: `live-security-admin-${suffix}@example.com`,
    adminPassword: "Password1!",
  };
};

const assertErrorCode = (response: SupertestResponse, code: string): void => {
  expect(response.body.success).toBe(false);
  expect(response.body.error.code).toBe(code);
};

describe.sequential("Auth API live security tests (real server)", () => {
  it("SEC-LIVE-01: /me rejects non-bearer authorization", async () => {
    const response = await liveApi
      .get("/api/auth/me")
      .set("Authorization", "Basic dXNlcjpwYXNz");

    expect(response.status).toBe(401);
    assertErrorCode(response, "UNAUTHORIZED");
  });

  it("SEC-LIVE-02: /me rejects malformed bearer token format", async () => {
    const response = await liveApi
      .get("/api/auth/me")
      .set("Authorization", "Bearer token-part-one token-part-two");

    expect(response.status).toBe(401);
    assertErrorCode(response, "UNAUTHORIZED");
  });

  it("SEC-LIVE-03: verify registration keeps generic invalid-or-expired message", async () => {
    const response = await liveApi.post("/api/auth/register-tenant/verify").send({
      registrationId: `missing-registration-${createUniqueSuffix()}`,
      verificationCode: "123456",
    });

    expect(response.status).toBe(401);
    assertErrorCode(response, "UNAUTHORIZED");
    expect(response.body.error.message).toBe("The verification code is invalid or expired.");
  });

  it("SEC-LIVE-04: refresh requires refreshToken payload", async () => {
    const response = await liveApi.post("/api/auth/refresh").send({});

    expect(response.status).toBe(400);
    assertErrorCode(response, "VALIDATION_ERROR");
  });

  it("SEC-LIVE-05: logout requires refreshToken payload", async () => {
    const response = await liveApi.post("/api/auth/logout").send({});

    expect(response.status).toBe(400);
    assertErrorCode(response, "VALIDATION_ERROR");
  });

  it("SEC-LIVE-06: register-tenant rejects unsafe tenantCode format", async () => {
    const payload = createRegisterPayload();
    payload.tenantCode = "bad-code-with-dash";

    const response = await liveApi.post("/api/auth/register-tenant").send(payload);

    expect(response.status).toBe(400);
    assertErrorCode(response, "VALIDATION_ERROR");
  });

  it("SEC-LIVE-07: repeated login attempts are rate-limited", async () => {
    const suffix = createUniqueSuffix();
    const attackEmail = `security-bruteforce-${suffix}@example.com`;
    const attempts = Array.from({ length: 6 }, () =>
      liveApi.post("/api/auth/login").send({
        email: attackEmail,
        password: "WrongPassword1!",
      }),
    );

    const responses = await Promise.all(attempts);
    const statusCodes = responses.map((response) => response.status);
    const rateLimitedResponses = responses.filter((response) => response.status === 429);

    expect(rateLimitedResponses.length).toBeGreaterThan(0);
    expect(statusCodes).toContain(401);

    const firstRateLimitedResponse = rateLimitedResponses[0];
    expect(firstRateLimitedResponse).toBeDefined();
    if (firstRateLimitedResponse) {
      assertErrorCode(firstRateLimitedResponse, "RATE_LIMITED");
    }
  });
});

