import type { CapacitorConfig } from '@capacitor/cli';

const hosted = process.env.OMI_NATIVE_TEST_WEB_ORIGIN;
const target = hosted ? new URL(hosted) : undefined;

if (target && (target.protocol !== 'https:' || target.origin !== hosted)) {
  throw new Error('OMI_NATIVE_TEST_WEB_ORIGIN must be one HTTPS origin');
}
if (target && process.env.OMI_NATIVE_RELEASE === '1') {
  throw new Error('Release sync cannot use the hosted native test mode');
}

const config: CapacitorConfig = {
  appId: 'lk.omi.tropical',
  appName: 'OMI — Tropical Adventure',
  webDir: 'dist',
  ...(target && { server: { url: target.origin, cleartext: false } }),
  android: { allowMixedContent: false },
};

export default config;
