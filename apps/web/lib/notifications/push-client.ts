"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { validAccessToken } from "@/lib/supabase/access-token";

export type PushState = "unsupported" | "blocked" | "inactive" | "active";

function applicationServerKey(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}

export async function currentPushState(): Promise<PushState> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  const registration = await navigator.serviceWorker.getRegistration("/sw.js");
  const subscription = await registration?.pushManager.getSubscription();
  return subscription ? "active" : "inactive";
}

export async function enablePushNotifications(client: SupabaseClient) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  if (!publicKey) throw new Error("De pushsleutel is nog niet geconfigureerd.");
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) throw new Error("Deze browser ondersteunt geen pushmeldingen.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Pushmeldingen zijn niet toegestaan in deze browser.");
  const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationServerKey(publicKey) });
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
