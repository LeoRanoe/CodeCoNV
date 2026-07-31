"use client";

import { useCallback, useEffect, useState } from "react";
import type { CurrentProjectWeather } from "@/lib/weather";

const refreshIntervalMs = 10 * 60 * 1000;

type CacheEntry = {
  weather: CurrentProjectWeather | null;
  error: string;
  fetchedAt: number;
  inflight: Promise<void> | null;
};

/**
 * One shared cache per project location. Several screens show live weather at the
 * same time; without this they would each hit the geocoding and forecast API.
 */
const cache = new Map<string, CacheEntry>();
const subscribers = new Map<string, Set<() => void>>();

function notify(location: string) {
  subscribers.get(location)?.forEach((listener) => listener());
}

async function refresh(location: string, force: boolean) {
  const entry = cache.get(location) ?? { weather: null, error: "", fetchedAt: 0, inflight: null };
  cache.set(location, entry);
  if (entry.inflight) return entry.inflight;
  if (!force && entry.weather && Date.now() - entry.fetchedAt < refreshIntervalMs) return;

  entry.inflight = (async () => {
    try {
      const response = await fetch(`/api/weather/current?location=${encodeURIComponent(location)}`, {
        headers: { accept: "application/json" },
      });
      const payload = await response.json() as CurrentProjectWeather | { error?: string };
      if (!response.ok || !("condition" in payload)) {
        throw new Error("error" in payload && payload.error ? payload.error : "Weather unavailable");
      }
      entry.weather = payload;
      entry.error = "";
    } catch (caught) {
      entry.error = caught instanceof Error ? caught.message : "Weather unavailable";
    } finally {
      entry.fetchedAt = Date.now();
      entry.inflight = null;
      notify(location);
    }
  })();
  return entry.inflight;
}

export function useLiveProjectWeather(location: string) {
  const [, setTick] = useState(0);
  const trimmed = location.trim();

  useEffect(() => {
    if (!trimmed) return;
    const listener = () => setTick((value) => value + 1);
    const listeners = subscribers.get(trimmed) ?? new Set<() => void>();
    listeners.add(listener);
    subscribers.set(trimmed, listeners);

    void refresh(trimmed, false);
    const timer = window.setInterval(() => void refresh(trimmed, true), refreshIntervalMs);
    return () => {
      window.clearInterval(timer);
      listeners.delete(listener);
      if (!listeners.size) subscribers.delete(trimmed);
    };
  }, [trimmed]);

  const entry = cache.get(trimmed);
  const reload = useCallback(() => {
    if (trimmed) void refresh(trimmed, true);
  }, [trimmed]);

  return {
    weather: entry?.weather ?? null,
    error: entry?.error ?? "",
    loading: Boolean(entry?.inflight) || (!entry && Boolean(trimmed)),
    reload,
  };
}
