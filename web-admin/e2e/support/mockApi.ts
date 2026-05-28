import type { Page, Route } from "@playwright/test";
import { authFixtures } from "../fixtures/auth.fixtures";
import { buildComputerDetailFixture } from "../fixtures/computer-detail.fixtures";
import { buildComputerListFixtures, type E2EComputer } from "../fixtures/computer-list.fixtures";
import { errorFixtures } from "../fixtures/error.fixtures";
import { reissueFixtures } from "../fixtures/reissue.fixtures";
import { updateFixtures } from "../fixtures/update.fixtures";

type ApiScenario = {
  forbiddenList?: boolean;
  updateFailure?: boolean;
  updateRateLimited?: boolean;
  reissueLongToken?: boolean;
};

type FoundationSuccess<TData> = {
  success: true;
  data: TData;
};

type FoundationError = {
  success: false;
  error: {
    code: string;
    message: string;
  };
};

export async function installMockApi(page: Page, scenario: ApiScenario = {}): Promise<void> {
  const computers = buildComputerListFixtures();

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const method = request.method();
    const requestUrl = new URL(request.url());
    const path = requestUrl.pathname;

    if (path === "/api/auth/login" && method === "POST") {
      await fulfillSuccess(route, authFixtures.loginResult);
      return;
    }

    if (path === "/api/auth/me" && method === "GET") {
      await fulfillSuccess(route, authFixtures.meResult);
      return;
    }

    if (path === "/api/auth/logout" && method === "POST") {
      await fulfillSuccess(route, null);
      return;
    }

    if (path === "/api/auth/refresh" && method === "POST") {
      await fulfillSuccess(route, authFixtures.loginResult);
      return;
    }

    if (path === "/api/computers" && method === "GET") {
      if (scenario.forbiddenList) {
        await fulfillError(route, errorFixtures.forbidden.status, errorFixtures.forbidden.code, errorFixtures.forbidden.message);
        return;
      }

      const response = filterSortAndPaginate(computers, requestUrl);
      await fulfillSuccess(route, response);
      return;
    }

    if (path.startsWith("/api/computers/") && path.endsWith("/reissue-token") && method === "POST") {
      const id = decodeURIComponent(path.split("/")[3] ?? "");
      const computer = computers.find((item) => item.id === id);
      if (!computer) {
        await fulfillError(route, 404, "NOT_FOUND", "Computer not found.");
        return;
      }

      const token = scenario.reissueLongToken ? reissueFixtures.longToken : reissueFixtures.plainToken;
      await fulfillSuccess(route, {
        computer,
        deviceToken: token,
      });
      return;
    }

    if (path.startsWith("/api/computers/") && method === "GET") {
      const id = decodeURIComponent(path.split("/")[3] ?? "");
      const computer = computers.find((item) => item.id === id);
      if (!computer) {
        await fulfillError(route, 404, "NOT_FOUND", "Computer not found.");
        return;
      }
      await fulfillSuccess(route, buildComputerDetailFixture(computer));
      return;
    }

    if (path.startsWith("/api/computers/") && method === "PATCH") {
      if (scenario.updateRateLimited) {
        await fulfillError(
          route,
          updateFixtures.rateLimitError.status,
          updateFixtures.rateLimitError.code,
          updateFixtures.rateLimitError.message,
        );
        return;
      }
      if (scenario.updateFailure) {
        await fulfillError(
          route,
          updateFixtures.failureError.status,
          updateFixtures.failureError.code,
          updateFixtures.failureError.message,
        );
        return;
      }

      const id = decodeURIComponent(path.split("/")[3] ?? "");
      const computer = computers.find((item) => item.id === id);
      if (!computer) {
        await fulfillError(route, 404, "NOT_FOUND", "Computer not found.");
        return;
      }
      const patchBody = request.postDataJSON() as Partial<E2EComputer>;
      const updated: E2EComputer = {
        ...computer,
        name: patchBody.name ?? computer.name,
        status: patchBody.status ?? computer.status,
        notes: patchBody.notes ?? computer.notes,
        updatedAt: "2026-05-28T15:00:00.000Z",
      };
      const index = computers.findIndex((item) => item.id === id);
      computers[index] = updated;
      await fulfillSuccess(route, updated);
      return;
    }

    await route.fallback();
  });
}

function filterSortAndPaginate(computers: E2EComputer[], url: URL): {
  items: E2EComputer[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
} {
  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Number(url.searchParams.get("pageSize") ?? "20");
  const status = url.searchParams.get("status");
  const query = (url.searchParams.get("q") ?? "").toLowerCase();
  const sort = url.searchParams.get("sort") ?? "createdAt:desc";

  let rows = [...computers];
  if (status) {
    rows = rows.filter((item) => item.status === status);
  }
  if (query) {
    rows = rows.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.macAddress.toLowerCase().includes(query),
    );
  }

  const [sortField, sortDirection] = sort.split(":");
  rows.sort((a, b) => {
    const aValue = String((a as Record<string, unknown>)[sortField] ?? "");
    const bValue = String((b as Record<string, unknown>)[sortField] ?? "");
    const cmp = aValue.localeCompare(bValue);
    return sortDirection === "asc" ? cmp : -cmp;
  });

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const normalizedPage = Math.min(Math.max(page, 1), totalPages);
  const start = (normalizedPage - 1) * pageSize;
  const items = rows.slice(start, start + pageSize);

  return {
    items,
    page: normalizedPage,
    pageSize,
    total,
    totalPages,
  };
}

async function fulfillSuccess<TData>(route: Route, data: TData): Promise<void> {
  const body: FoundationSuccess<TData> = {
    success: true,
    data,
  };
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function fulfillError(
  route: Route,
  status: number,
  code: string,
  message: string,
): Promise<void> {
  const body: FoundationError = {
    success: false,
    error: { code, message },
  };
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}
