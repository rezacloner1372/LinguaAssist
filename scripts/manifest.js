/**
 * Turns the base manifest.json (written for Chrome) into a browser-specific
 * manifest. Shared by webpack.config.js and the packaging script.
 *
 * Why the browsers need different manifests:
 *  - Chrome runs the background as a service worker; Firefox does not support
 *    `background.service_worker` and uses `background.scripts` (an event page).
 *  - Firefox has no `tts` API/permission (the Listen button falls back to the
 *    Web Speech API in the page).
 *  - Firefox needs `browser_specific_settings.gecko` with a permanent add-on ID
 *    and, for new AMO submissions, `data_collection_permissions`.
 */

// Permanent once the add-on is signed on addons.mozilla.org — never change it.
const GECKO_ID = 'linguaassist@rezacloner1372';

// 140 is the first desktop Firefox with the built-in data-consent prompt.
const FIREFOX_MIN_VERSION = '140.0';

/** @param {string} baseJson contents of manifest.json  @param {'chrome'|'firefox'} browser */
function buildManifest(baseJson, browser) {
  const manifest = JSON.parse(baseJson);

  if (browser === 'firefox') {
    // Firefox takes the author as a plain string (Chrome expects a different shape, so it is omitted there).
    manifest.author = 'Mohammadreza Saberi';
    manifest.background = { scripts: [manifest.background.service_worker] };
    manifest.permissions = manifest.permissions.filter((p) => p !== 'tts');
    manifest.browser_specific_settings = {
      gecko: {
        id: GECKO_ID,
        strict_min_version: FIREFOX_MIN_VERSION,
        // Selected text / page content and the API key are sent to the endpoint
        // the user configures, so they are declared as required data types.
        data_collection_permissions: {
          required: ['websiteContent', 'authenticationInfo'],
        },
      },
    };
  }

  return JSON.stringify(manifest, null, 2) + '\n';
}

module.exports = { buildManifest, GECKO_ID, FIREFOX_MIN_VERSION };
