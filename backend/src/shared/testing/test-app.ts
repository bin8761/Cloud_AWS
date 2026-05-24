import type { Express } from "express";
import { app } from "../../app";

export const getTestApp = (): Express => app;

