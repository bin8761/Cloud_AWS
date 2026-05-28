export const authFixtures = {
  loginInput: {
    email: "admin@example.com",
    password: "Password123!",
  },
  loginResult: {
    accessToken: "access-token-e2e",
    refreshToken: "refresh-token-e2e",
  },
  meResult: {
    user: {
      id: "user-1",
      email: "admin@example.com",
      fullName: "Admin User",
      role: "TENANT_ADMIN",
      tenantId: "tenant-1",
    },
    tenant: {
      id: "tenant-1",
      name: "E2E Tenant",
    },
  },
} as const;
