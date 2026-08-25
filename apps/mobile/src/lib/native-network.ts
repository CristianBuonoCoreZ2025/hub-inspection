/**
 * Red nativa — usa @capacitor/network para detectar online/offline en nativo.
 * En web, usa navigator.onLine.
 */

import { Network } from "@capacitor/network";
import { isNativePlatform } from "./platform";

export async function isOnline(): Promise<boolean> {
  if (isNativePlatform()) {
    const status = await Network.getStatus();
    return status.connected;
  }
  return navigator.onLine;
}

export function onNetworkChange(callback: (online: boolean) => void): () => void {
  if (isNativePlatform()) {
    const handle = Network.addListener("networkStatusChange", (status) => {
      callback(status.connected);
    });
    return () => {
      handle.then((h) => h.remove());
    };
  }

  const onOnline = () => callback(true);
  const onOffline = () => callback(false);
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);
  return () => {
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
  };
}
