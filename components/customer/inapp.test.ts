import test from 'node:test';
import assert from 'node:assert/strict';
import { browserFamily, isInAppBrowser } from './inapp';

const IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)';
const UA = {
  instagramIos: `${IOS} Mobile/21E219 Instagram 345.0.1.20.116 (iPhone14,5; iOS 17_4; en_US; en-US; scale=3.00; 1170x2532; 633310738)`,
  facebookIos: `${IOS} Mobile/21E219 [FBAN/FBIOS;FBAV/450.0.0.38.108;FBBV/565043637;FBDV/iPhone14,5;FBMD/iPhone;FBSN/iOS;FBSV/17.4;FBSS/3;FBID/phone;FBLC/en_US;FBOP/5]`,
  facebookAndroid:
    'Mozilla/5.0 (Linux; Android 13; SM-A546E Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.6367.82 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/450.0.0.38.108;]',
  whatsapp: `${IOS} Mobile/21E219 WhatsApp/24.6.77`,
  google: `${IOS} GSA/320.0.636000000 Mobile/15E148 Safari/604.1`,
  linkedin: `${IOS} Mobile/21E219 LinkedInApp/9.30.2004`,
  line: `${IOS} Mobile/21E219 Safari Line/13.2.0`,
  snapchat: `${IOS} Mobile/21E219 Snapchat/12.80.0.34 (iPhone14,5; iOS 17.4; gzip)`,
  androidWebView:
    'Mozilla/5.0 (Linux; Android 13; SM-A546E Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.6367.82 Mobile Safari/537.36',
  safari: `${IOS} Version/17.4 Mobile/15E148 Safari/604.1`,
  chromeAndroid:
    'Mozilla/5.0 (Linux; Android 13; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36',
  chromeIos: `${IOS} CriOS/124.0.6367.88 Mobile/15E148 Safari/604.1`,
  firefoxIos: `${IOS} FxiOS/125.0 Mobile/15E148 Safari/605.1.15`,
  samsung:
    'Mozilla/5.0 (Linux; Android 13; SAMSUNG SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/117.0.0.0 Mobile Safari/537.36',
};

for (const name of ['instagramIos', 'facebookIos', 'facebookAndroid', 'whatsapp', 'google', 'linkedin', 'line', 'snapchat', 'androidWebView'] as const) {
  test(`in-app browser: ${name}`, () => {
    assert.equal(isInAppBrowser(UA[name]), true);
    assert.equal(browserFamily(UA[name]), 'in_app');
  });
}

test('iPhone Safari is safari, not in-app', () => {
  assert.equal(isInAppBrowser(UA.safari), false);
  assert.equal(browserFamily(UA.safari), 'safari');
});

test('Android Chrome is chrome, not in-app', () => {
  assert.equal(isInAppBrowser(UA.chromeAndroid), false);
  assert.equal(browserFamily(UA.chromeAndroid), 'chrome');
});

test('Chrome on iOS is chrome, not in-app', () => {
  assert.equal(isInAppBrowser(UA.chromeIos), false);
  assert.equal(browserFamily(UA.chromeIos), 'chrome');
});

test('Firefox on iOS is firefox, not in-app', () => {
  assert.equal(isInAppBrowser(UA.firefoxIos), false);
  assert.equal(browserFamily(UA.firefoxIos), 'firefox');
});

test('Samsung Internet is samsung, not in-app', () => {
  assert.equal(isInAppBrowser(UA.samsung), false);
  assert.equal(browserFamily(UA.samsung), 'samsung');
});

test('empty user agent is other, not in-app', () => {
  assert.equal(isInAppBrowser(''), false);
  assert.equal(browserFamily(''), 'other');
});
