/**
 * Haptics nativo — vibración táctil en iOS/Android.
 */

import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { isNativePlatform } from "./platform";

export async function hapticLight(): Promise<void> {
  if (!isNativePlatform()) return;
  await Haptics.impact({ style: ImpactStyle.Light });
}

export async function hapticMedium(): Promise<void> {
  if (!isNativePlatform()) return;
  await Haptics.impact({ style: ImpactStyle.Medium });
}

export async function hapticHeavy(): Promise<void> {
  if (!isNativePlatform()) return;
  await Haptics.impact({ style: ImpactStyle.Heavy });
}

export async function hapticSuccess(): Promise<void> {
  if (!isNativePlatform()) return;
  await Haptics.notification({ type: NotificationType.Success });
}

export async function hapticError(): Promise<void> {
  if (!isNativePlatform()) return;
  await Haptics.notification({ type: NotificationType.Error });
}

export async function hapticWarning(): Promise<void> {
  if (!isNativePlatform()) return;
  await Haptics.notification({ type: NotificationType.Warning });
}
