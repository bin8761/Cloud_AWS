import { prisma } from "../../shared/prisma/prisma.client";
import { AppError } from "../../shared/errors/app-error";
import type { AuthContext } from "../../shared/middleware/auth-context";
import type { StartSessionInput, EndSessionInput } from "./sessions.types";

export class SessionsService {
  public async startSession(
    authContext: AuthContext,
    input: StartSessionInput,
  ) {
    const tenantId = authContext.tenantId as string;

    // Kiểm tra không có session ACTIVE cho máy này
    const existing = await prisma.session.findFirst({
      where: { tenantId, computerId: input.computerId, status: "ACTIVE" },
    });
    if (existing) {
      throw new AppError(
        409,
        "CONFLICT",
        "Máy này đang có phiên chơi đang hoạt động.",
      );
    }

    // Kiểm tra computer thuộc tenant
    const computer = await prisma.computer.findFirst({
      where: { id: input.computerId, tenantId },
    });
    if (!computer) {
      throw new AppError(404, "NOT_FOUND", "Không tìm thấy máy trạm.");
    }

    const session = await prisma.session.create({
      data: {
        tenantId,
        computerId: input.computerId,
        status: "ACTIVE",
      },
    });

    return session;
  }

  public async endSession(
    authContext: AuthContext,
    input: EndSessionInput,
  ) {
    const tenantId = authContext.tenantId as string;

    const session = await prisma.session.findFirst({
      where: { id: input.sessionId, tenantId, status: "ACTIVE" },
    });
    if (!session) {
      throw new AppError(
        404,
        "NOT_FOUND",
        "Không tìm thấy phiên chơi đang hoạt động.",
      );
    }

    const endedAt = new Date();
    const durationMs = endedAt.getTime() - session.startedAt.getTime();
    const durationMinutes = Math.max(1, Math.ceil(durationMs / 60000));
    const totalAmount =
      Math.round(((durationMinutes / 60) * input.pricePerHour) * 100) / 100;

    // Transaction: update session + tạo usageLog + upsert DailyUsageSummary
    const [updatedSession] = await prisma.$transaction(async (tx) => {
      const updated = await tx.session.update({
        where: { id: input.sessionId },
        data: {
          status: "ENDED",
          endedAt,
          durationMinutes,
          totalAmount,
        },
      });

      await tx.usageLog.create({
        data: {
          tenantId,
          computerId: session.computerId,
          sessionId: input.sessionId,
          startedAt: session.startedAt,
          endedAt,
          durationMinutes,
          pricePerHour: input.pricePerHour,
          totalAmount,
        },
      });

      // Tổng hợp DailyUsageSummary theo ngày bắt đầu phiên
      const dateOnly = new Date(session.startedAt);
      dateOnly.setHours(0, 0, 0, 0);

      await tx.dailyUsageSummary.upsert({
        where: {
          tenantId_computerId_date: {
            tenantId,
            computerId: session.computerId,
            date: dateOnly,
          },
        },
        update: {
          totalMinutes: { increment: durationMinutes },
          totalAmount: { increment: totalAmount },
          sessionCount: { increment: 1 },
        },
        create: {
          tenantId,
          computerId: session.computerId,
          date: dateOnly,
          totalMinutes: durationMinutes,
          totalAmount,
          sessionCount: 1,
        },
      });

      return [updated];
    });

    return updatedSession;
  }

  public async getActiveSessions(authContext: AuthContext) {
    const tenantId = authContext.tenantId as string;

    return prisma.session.findMany({
      where: { tenantId, status: "ACTIVE" },
      include: {
        computer: { select: { id: true, name: true, macAddress: true } },
      },
      orderBy: { startedAt: "asc" },
    });
  }
}

export const sessionsService = new SessionsService();