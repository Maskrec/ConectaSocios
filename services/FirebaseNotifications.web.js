// Mock / dummy file for web platform to prevent crashes from native Firebase/Notifee dependencies
export async function requestUserPermission() {
  return false;
}

export async function setupNotificationChannels() {
  return;
}

export async function getFcmToken() {
  return null;
}

export function initializeFcmListeners() {
  return () => {};
}
