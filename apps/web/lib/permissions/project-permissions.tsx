"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * What the signed-in user may do on the open project, so a screen can leave out the buttons
 * that would only ever answer "403".
 *
 * This is advisory and fails open: until the answer is there, offline without an earlier
 * answer, or against a database that does not have `my_project_permissions` yet, every
 * control is shown as before. The database remains the only authority; every write is
 * checked there whatever the screen shows.
 */
export type ProjectPermissions = {
  /** True once a real answer is known (not the fail-open default). */
  known: boolean;
  /** Whether the user holds this permission code on the project. Always true while unknown. */
  can: (code: string) => boolean;
  /** Whether the user holds at least one of the codes. */
  canAny: (...codes: string[]) => boolean;
};

export const openPermissions: ProjectPermissions = { known: false, can: () => true, canAny: () => true };

const ProjectPermissionsContext = createContext<ProjectPermissions>(openPermissions);

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
  if (!codes) return openPermissions;
  const granted = new Set(codes);
  return {
    known: true,
    can: (code) => granted.has(code),
    canAny: (...wanted) => wanted.some((code) => granted.has(code)),
  };
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
  return useMemo(() => permissionsFrom(query.data), [query.data]);
}

export function ProjectPermissionsProvider({ value, children }: { value: ProjectPermissions; children: ReactNode }) {
  return <ProjectPermissionsContext.Provider value={value}>{children}</ProjectPermissionsContext.Provider>;
}

export function useProjectPermissions(): ProjectPermissions {
  return useContext(ProjectPermissionsContext);
}
