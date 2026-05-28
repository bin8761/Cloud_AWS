import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getComputer,
  listComputers,
  reissueComputerToken,
  updateComputer,
} from "./computers.api";
import { buildUpdateComputerPayload } from "./computerPayload";
import type {
  Computer,
  ComputersListResponse,
  ComputersListQuery,
  ReissueTokenInput,
  UpdateComputerInput,
} from "./computers.types";

export const computersQueryKeys = {
  all: ["computers"] as const,
  list: (query: ComputersListQuery = {}) =>
    [
      ...computersQueryKeys.all,
      "list",
      {
        page: query.page ?? null,
        pageSize: query.pageSize ?? null,
        status: query.status ?? null,
        q: query.q ?? null,
        sort: query.sort ?? null,
      },
    ] as const,
  detail: (computerId: string) =>
    [...computersQueryKeys.all, "detail", computerId] as const,
};

export function useComputersListQuery(query: ComputersListQuery = {}) {
  return useQuery({
    queryKey: computersQueryKeys.list(query),
    queryFn: () => listComputers(query),
  });
}

export function useComputerDetailQuery(computerId?: string | null) {
  return useQuery({
    queryKey: computersQueryKeys.detail(computerId ?? ""),
    queryFn: () => getComputer(computerId as string),
    enabled: Boolean(computerId),
  });
}

type UpdateComputerMutationInput = {
  id: string;
  input: UpdateComputerInput;
};

type UpdateComputerMutationContext = {
  previousListCache: Array<[readonly unknown[], ComputersListResponse | undefined]>;
  previousDetailCache: Computer | undefined;
};

export function useUpdateComputerMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    onMutate: async (variables): Promise<UpdateComputerMutationContext> => {
      await queryClient.cancelQueries({ queryKey: computersQueryKeys.all });

      const previousListCache = queryClient.getQueriesData<ComputersListResponse>({
        queryKey: [...computersQueryKeys.all, "list"],
      });
      const previousDetailCache = queryClient.getQueryData<Computer>(
        computersQueryKeys.detail(variables.id),
      );
      const optimisticPatch = buildUpdateComputerPayload(variables.input);

      previousListCache.forEach(([queryKey, cachedList]) => {
        if (!cachedList) {
          return;
        }

        queryClient.setQueryData<ComputersListResponse>(queryKey, {
          ...cachedList,
          items: cachedList.items.map((computer) =>
            computer.id === variables.id
              ? {
                  ...computer,
                  ...optimisticPatch,
                }
              : computer,
          ),
        });
      });

      if (previousDetailCache && previousDetailCache.id === variables.id) {
        queryClient.setQueryData<Computer>(computersQueryKeys.detail(variables.id), {
          ...previousDetailCache,
          ...optimisticPatch,
        });
      }

      return {
        previousListCache,
        previousDetailCache,
      };
    },
    onSuccess: (updatedComputer, variables) => {
      const currentListCache = queryClient.getQueriesData<ComputersListResponse>({
        queryKey: [...computersQueryKeys.all, "list"],
      });

      currentListCache.forEach(([queryKey, cachedList]) => {
        if (!cachedList) {
          return;
        }

        queryClient.setQueryData<ComputersListResponse>(queryKey, {
          ...cachedList,
          items: cachedList.items.map((computer) =>
            computer.id === variables.id ? updatedComputer : computer,
          ),
        });
      });

      queryClient.setQueryData<Computer>(
        computersQueryKeys.detail(variables.id),
        (currentDetail) => {
          if (!currentDetail || currentDetail.id !== variables.id) {
            return currentDetail;
          }

          return updatedComputer;
        },
      );
    },
    onError: (_error, variables, context) => {
      if (!context) {
        return;
      }

      context.previousListCache.forEach(([queryKey, previousList]) => {
        queryClient.setQueryData<ComputersListResponse | undefined>(
          queryKey,
          previousList,
        );
      });

      queryClient.setQueryData<Computer | undefined>(
        computersQueryKeys.detail(variables.id),
        context.previousDetailCache,
      );
    },
    mutationFn: ({ id, input }: UpdateComputerMutationInput) =>
      updateComputer(id, input),
  });
}

type ReissueComputerTokenMutationInput = {
  id: string;
  input: ReissueTokenInput;
};

export function useReissueComputerTokenMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    onSuccess: (result, variables) => {
      const updatedComputer = result.computer;
      const currentListCache = queryClient.getQueriesData<ComputersListResponse>({
        queryKey: [...computersQueryKeys.all, "list"],
      });

      currentListCache.forEach(([queryKey, cachedList]) => {
        if (!cachedList) {
          return;
        }

        queryClient.setQueryData<ComputersListResponse>(queryKey, {
          ...cachedList,
          items: cachedList.items.map((computer) =>
            computer.id === variables.id ? updatedComputer : computer,
          ),
        });
      });

      queryClient.setQueryData<Computer>(
        computersQueryKeys.detail(variables.id),
        (currentDetail) => {
          if (!currentDetail || currentDetail.id !== variables.id) {
            return currentDetail;
          }

          return updatedComputer;
        },
      );
    },
    mutationFn: ({ id, input }: ReissueComputerTokenMutationInput) =>
      reissueComputerToken(id, input),
  });
}
