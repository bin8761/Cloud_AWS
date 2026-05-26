import { AppError } from "../../shared/errors/app-error";
import { prisma } from "../../shared/prisma/prisma.client";

export class SubscriptionsGuard {
  /**
   * Xác thực xem Tenant có gói dịch vụ ACTIVE và còn thời hạn hay không.
   * Nếu không hợp lệ, ném ra AppError 402 PAYMENT_REQUIRED.
   */
  public static async verifyActiveSubscription(tenantId: string): Promise<void> {
    const sub = await prisma.subscription.findUnique({
      where: {
        tenantId,
      },
    });

    if (!sub) {
      throw new AppError(
        402,
        "PAYMENT_REQUIRED",
        "No active subscription found for this tenant.",
      );
    }

    if (sub.status !== "ACTIVE") {
      throw new AppError(
        402,
        "PAYMENT_REQUIRED",
        `Tenant subscription status is ${sub.status}.`,
      );
    }

    if (sub.expiresAt < new Date()) {
      throw new AppError(402, "PAYMENT_REQUIRED", "Tenant subscription has expired.");
    }
  }

  /**
   * Kiểm tra xem việc thêm máy trạm mới có vượt quá giới hạn maxComputers của gói hay không.
   * Nếu vượt quá, ném ra AppError 403 FORBIDDEN.
   */
  public static async assertComputerLimitNotExceeded(
    tenantId: string,
    limit: number,
  ): Promise<void> {
    const count = await prisma.computer.count({
      where: {
        tenantId,
      },
    });

    if (count >= limit) {
      throw new AppError(
        403,
        "FORBIDDEN",
        "Maximum computer limit reached for this tenant's subscription.",
      );
    }
  }
}
