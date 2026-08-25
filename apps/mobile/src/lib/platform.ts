/**
 * Detector de plataforma nativa.
 *
 * Verifica si la app está corriendo dentro de Capacitor (iOS/Android)
 * o en el navegador web normal.
 */

import { Capacitor } from "@capacitor/core";

export const isNativePlatform = (): boolean => {
  if (typeof window === "undefined") return false;
  return Capacitor.isNativePlatform();
};

export const getPlatform = (): "ios" | "android" | "web" => {
  return Capacitor.getPlatform() as "ios" | "android" | "web";
};

export const isIOS = (): boolean => getPlatform() === "ios";
export const isAndroid = (): boolean => getPlatform() === "android";
export const isWeb = (): boolean => getPlatform() === "web";
