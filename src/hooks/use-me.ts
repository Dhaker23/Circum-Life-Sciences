"use client";
import { useQuery } from "@tanstack/react-query";

export interface MeResponse {
  authenticated: boolean;
  user?: { id: string; email: string; name: string | null; preferredLocale: string; status: string };
  permissions?: string[];
  resolvedSites?: "*" | string[];
  assignments?: { role: string; siteId: string | null; departmentId: string | null }[];
}

export function useMe() {
  return useQuery<MeResponse>({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await fetch("/api/me", { credentials: "same-origin" });
      if (!res.ok) throw new Error("Failed to load session");
      const json = await res.json();
      return json.data as MeResponse;
    },
    retry: false,
    staleTime: 60_000,
  });
}

export function usePermissions(): Set<string> {
  const { data } = useMe();
  return new Set(data?.permissions ?? []);
}
