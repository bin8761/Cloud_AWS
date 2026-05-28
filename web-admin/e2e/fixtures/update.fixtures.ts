export const updateFixtures = {
  successPatch: {
    name: "Workstation Updated",
    status: "ACTIVE" as const,
    notes: "Updated from playwright",
  },
  failureError: {
    status: 500,
    code: "UPDATE_FAILED",
    message: "Update failed by fixture.",
  },
  rateLimitError: {
    status: 429,
    code: "RATE_LIMITED",
    message: "Too many attempts.",
  },
} as const;
