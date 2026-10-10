"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { permissionsFrom as permissionsFromCodes, restrictedPermissions } from "./permission-model.mjs";

/**
 * What the signed-in user may do on the open project, so a screen can leave out the buttons
 * that would only ever answer "403".
 *
 * Until the answer is there, offline without an earlier answer, or when the call is missing or
 * failing, only reading is offered and every control that writes stays hidden. The database
 * remains the only authority; every write is checked there whatever the screen shows.
 */
export type ProjectPermissions = {
  /** True once a real answer is known (not the read-only default). */
  known: boolean;
  /** Whether the user holds this permission code on the project. While unknown only read codes are true. */
  can: (code: string) => boolean;
  /** Whether the user holds at least one of the codes. */
  canAny: (...codes: string[]) => boolean;
};

export const readOnlyPermissions: ProjectPermissions = restrictedPermissions;

const ProjectPermissionsContext = createContext<ProjectPermissions>(readOnlyPermissions);

const storageKey = (userId: string, projectId: string) => `codeco-permissions:${userId}:${projectId}`;

function readCached(userId: string, projectId: string): string[] | undefined {
  try {
    const raw = window.localStorage.getItem(storageKey(userId, projectId));
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return Array.isArray(parsed) && parsed.every((item) => typeof item === "string") ? (parsed as string[]) : undefined;
  } catch {
    return undefined;
  }
}

function writeCached(userId: string, projectId: string, codes: string[]) {
  try {
    window.localStorage.setItem(storageKey(userId, projectId), JSON.stringify(codes));
  } catch {
    // Private mode or a full disk: the answer just is not remembered.
  }
}

export function permissionsFrom(codes: readonly string[] | undefined): ProjectPermissions {
  return permissionsFromCodes(codes as string[] | undefined);
}

/** Loads the permission codes for one project; remembers the last answer per account and project. */
export function useProjectPermissionsQuery(client: SupabaseClient | null, userId: string | null | undefined, projectId: string | null | undefined): ProjectPermissions {
  const enabled = Boolean(client && userId && projectId);
  const query = useQuery({
    queryKey: ["project-permissions", userId ?? null, projectId ?? null],
    enabled,
    staleTime: 5 * 60_000,
    // The role of someone who is suspended or re-assigned must not linger.
    refetchOnWindowFocus: true,
    initialDataUpdatedAt: 0,
    initialData: () => (enabled && typeof window !== "undefined" ? readCached(userId!, projectId!) : undefined),
    queryFn: async () => {
      const result = await client!.rpc("my_project_permissions", { p_project_id: projectId });
      if (result.error) throw result.error;
      const codes = (result.data ?? []) as string[];
      writeCached(userId!, projectId!, codes);
      return codes;
    },
    retry: false,
  });
  // A cached answer carries a device through a dropped or weak connection. When the database answers
  // and refuses, an old answer must not keep write controls on screen.
  // A network failure keeps the cached answer (the device is simply out of reach); only an answer from
  // the database itself (a PostgREST or Postgres error code) means the permissions cannot be confirmed.
  const errorCode = (query.error as unknown as { code?: unknown } | null)?.code;
  const failedOnline = query.isError && typeof errorCode === "string" && errorCode.length > 0;
  return useMemo(() => (failedOnline ? readOnlyPermissions : permissionsFrom(query.data)), [failedOnline, query.data]);
}

export function ProjectPermissionsProvider({ value, children }: { value: ProjectPermissions; children: ReactNode }) {
  return <ProjectPermissionsContext.Provider value={value}>{children}</ProjectPermissionsContext.Provider>;
}

export function useProjectPermissions(): ProjectPermissions {
  return useContext(ProjectPermissionsContext);
}
