"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { validAccessToken } from "@/lib/supabase/access-token";

export type PushState = "unsupported" | "ios-add-to-home-screen" | "blocked" | "not-configured" | "inactive" | "active";

function isIosDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandaloneDisplay() {
  return window.matchMedia?.("(display-mode: standalone)").matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function applicationServerKey(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}

function sameApplicationServerKey(subscription: PushSubscription, expected: Uint8Array) {
  const current = subscription.options.applicationServerKey;
  if (!current) return false;
  const bytes = new Uint8Array(current);
  return bytes.length === expected.length && bytes.every((value, index) => value === expected[index]);
}

export async function currentPushState(): Promise<PushState> {
  if (typeof window === "undefined" || typeof navigator === "undefined") return "unsupported";
  if (isIosDevice() && !isStandaloneDisplay()) return "ios-add-to-home-screen";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return isIosDevice() && !isStandaloneDisplay() ? "ios-add-to-home-screen" : "unsupported";
  }
  if (Notification.permission === "denied") return "blocked";
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  if (!publicKey) return "not-configured";
  try {
    const registration = await navigator.serviceWorker.getRegistration("/");
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription || Notification.permission !== "granted" || (subscription.expirationTime !== null && subscription.expirationTime <= Date.now())) return "inactive";
    return sameApplicationServerKey(subscription, applicationServerKey(publicKey)) ? "active" : "inactive";
  } catch { return "unsupported"; }
}

export async function enablePushNotifications(client: SupabaseClient) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  if (!publicKey) throw new Error("De pushsleutel is nog niet geconfigureerd.");
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) throw new Error("Deze browser ondersteunt geen pushmeldingen.");
  if (isIosDevice() && !isStandaloneDisplay()) throw new Error("Installeer de app eerst op het beginscherm.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Pushmeldingen zijn niet toegestaan in deze browser.");
  await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  let readyTimer: ReturnType<typeof setTimeout> | undefined;
  const registration = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) => { readyTimer = setTimeout(() => reject(new Error("De serviceworker is niet beschikbaar. Herlaad de app en probeer opnieuw.")), 15_000); }),
  ]).finally(() => clearTimeout(readyTimer));
  const expectedKey = applicationServerKey(publicKey);
  let subscription = await registration.pushManager.getSubscription();
  if (subscription && !sameApplicationServerKey(subscription, expectedKey)) {
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: expectedKey });
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) throw new Error("Het apparaat gaf geen volledige pushregistratie terug.");
  const response = await fetch("/api/notifications/push-subscriptions", {
    method: "POST",
    headers: { authorization: `Bearer ${await validAccessToken(client)}`, "content-type": "application/json" },
    body: JSON.stringify({ endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error ?? "Pushregistratie kon niet worden opgeslagen.");
  }
  return true;
}
