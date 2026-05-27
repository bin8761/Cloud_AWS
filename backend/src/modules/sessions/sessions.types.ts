export interface StartSessionInput {
  computerId: string;
  pricePerHour: number;
}

export interface EndSessionInput {
  sessionId: string;
  pricePerHour: number;
}