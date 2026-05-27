import { prisma } from "../../shared/prisma/prisma.client";
import type { AuthContext } from "../../shared/middleware/auth-context";
import type { GetDashboardInput, GetRecentSessionsInput } from "./usage.types";

interface DailyDataEntry {
  date: string;
  totalAmount: number;
  sessionCount: number;
  totalMinutes: number;
}

export class UsageService {
  public async getDashboard(
    authContext: AuthContext,
    input: GetDashboardInput,
  ) {
    const tenantId = authContext.tenantId as string;
    const days = input.days ?? 7;

    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const summaries = await prisma.dailyUsageSummary.findMany({
      where: { tenantId, date: { gte: since } },
      orderBy: { date: "asc" },
    });

    // Gộp tất cả máy theo ngày
    const byDate: { [key: string]: DailyDataEntry } = {};

    for (const s of summaries) {
      const key = s.date.toISOString().split("T")[0];
      if (!byDate[key]) {
        byDate[key] = {
          date: key,
          totalAmount: 0,
          sessionCount: 0,
          totalMinutes: 0,
        };
      }
      byDate[key].totalAmount += Number(s.totalAmount);
      byDate[key].sessionCount += s.sessionCount;
      byDate[key].totalMinutes += s.totalMinutes;
    }

    const dailyData: DailyDataEntry[] = Object.values(byDate);

    let totalRevenue = 0;
    let totalSessions = 0;
    let totalMinutes = 0;

    for (const d of dailyData) {
      totalRevenue += d.totalAmount;
      totalSessions += d.sessionCount;
      totalMinutes += d.totalMinutes;
    }

    return {
      dailyData,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalSessions,
      totalMinutes,
      days,
    };
  }

  public async getRecentSessions(
    authContext: AuthContext,
    input: GetRecentSessionsInput,
  ) {
    const tenantId = authContext.tenantId as string;
    const page = input.page ?? 1;
    const pageSize = Math.min(input.pageSize ?? 20, 100);
    const skip = (page - 1) * pageSize;

    const [sessions, total] = await Promise.all([
      prisma.session.findMany({
        where: { tenantId },
        orderBy: { startedAt: "desc" },
        skip,
        take: pageSize,
        include: {
          computer: { select: { id: true, name: true, macAddress: true } },
        },
      }),
      prisma.session.count({ where: { tenantId } }),
    ]);

    return {
      sessions,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}

export const usageService = new UsageService();