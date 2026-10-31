import type { TelemetryBody } from '@/lib/api-types';

// Known in-app browsers and Android WebView ("; wv)"). They either lack getUserMedia or block the mic prompt.
const IN_APP = /FBAN|FBAV|FB_IAB|Instagram|WhatsApp|GSA\/|LinkedInApp|\bLine\/|Snapchat|MicroMessenger|TikTok|musical_ly|Twitter|Pinterest|; wv\)/i;

export function isInAppBrowser(ua: string): boolean {
  if (IN_APP.test(ua)) return true;
  // iOS web views (WKWebView) omit the "Safari/" token that real Safari, Chrome and Firefox on iOS all send.
  return /iPhone|iPad|iPod/.test(ua) && !/Safari\//.test(ua);
}

export function browserFamily(ua: string): TelemetryBody['browser'] {
  if (isInAppBrowser(ua)) return 'in_app';
  if (/FxiOS|Firefox\//.test(ua)) return 'firefox';
  if (/SamsungBrowser/.test(ua)) return 'samsung';
  if (/Edg(e|A|iOS)?\/|OPR\/|OPiOS/.test(ua)) return 'other';
  if (/CriOS|Chrome\//.test(ua)) return 'chrome';
  if (/Safari\//.test(ua) && /Version\//.test(ua)) return 'safari';
  return 'other';
}
