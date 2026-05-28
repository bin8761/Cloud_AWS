const LONG_TOKEN =
  "tok_" +
  "abcdefghijklmnopqrstuvwxyz0123456789".repeat(8) +
  "_very_long_one_time_device_token_for_wrapping_check";

export const reissueFixtures = {
  reason: "Client PC was reinstalled",
  plainToken: "tok_short_12345",
  longToken: LONG_TOKEN,
} as const;
