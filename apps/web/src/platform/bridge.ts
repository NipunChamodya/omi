import { Capacitor } from '@capacitor/core';

export async function observeNativeApp(
  onBack: () => void,
  onResume: () => void,
) {
  if (!Capacitor.isNativePlatform()) return;
  const { App } = await import('@capacitor/app');
  const resume = await App.addListener('appStateChange', ({ isActive }) => {
    if (isActive) onResume();
  });
  try {
    const back =
      Capacitor.getPlatform() === 'android'
        ? await App.addListener('backButton', onBack)
        : undefined;
    return () => {
      void resume.remove();
      void back?.remove();
    };
  } catch (error) {
    await resume.remove();
    throw error;
  }
}
