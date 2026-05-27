import { z } from "zod";

export const startSessionSchema = z.object({
  computerId: z.string().min(1, "computerId is required"),
  pricePerHour: z.number().positive("The price must be greater than 0"),
});

export const endSessionSchema = z.object({
  sessionId: z.string().min(1, "sessionId is required"),
  pricePerHour: z.number().positive("The price must be greater than 0"),
});