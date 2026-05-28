export type ComputerControlPayload =
  | { computerId: string; action: "lock" }
  | {
      computerId: string;
      action: "unlock";
      mode: "free";
    }
  | {
      computerId: string;
      action: "unlock";
      mode: "timed";
      durationMinutes: number;
    };

export const buildTimedPayload = (
  computerId: string,
  hours: number,
): ComputerControlPayload => {
  const durationMinutes = Math.round(hours * 60);
  if (durationMinutes < 1 || durationMinutes > 1440) {
    throw new Error("Duration must be between 1 and 1440 minutes.");
  }

  return {
    computerId,
    action: "unlock",
    mode: "timed",
    durationMinutes,
  };
};

export const buildFreePayload = (computerId: string): ComputerControlPayload => ({
  computerId,
  action: "unlock",
  mode: "free",
});

export const buildLockPayload = (computerId: string): ComputerControlPayload => ({
  computerId,
  action: "lock",
});
