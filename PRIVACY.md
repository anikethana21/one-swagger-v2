# Privacy Policy - One Swagger

**Last updated: 22 October 2026**

One Swagger is a local-first OpenAPI documentation viewer and HTTP request console. It does not require an account and does not include analytics, advertising, telemetry or a remote backend.

## What One Swagger stores

The app stores the following for the current browser profile:

- Your theme preference.
- Recently opened specification URLs and their titles.
- The last specification URL.
- Your request-console draft (method, URL, headers, parameters, body and body type).
- API credentials you explicitly enter (Bearer tokens, Basic credentials, API keys, OAuth access tokens).
- Request history (method, URL, status, timing, response size, request headers, request body and a short response preview).
- Per-spec base URL overrides.

The Chrome extension uses browser local storage. The Tampermonkey userscript uses Tampermonkey storage so the same history and settings are available across sites. This data never leaves your device except when it is included in a request you explicitly send to an API. For example, an Authorization header is sent to the API that you chose to call.

## Network requests

One Swagger sends requests only to URLs that you enter or that are declared as servers in a specification you load.

- The web build uses `fetch()` from the page.
- The Chrome extension sends requests through its Manifest V3 service worker so that APIs without CORS headers can still be used.
- The Tampermonkey userscript sends requests through `GM_xmlhttpRequest` for the same zero-CORS behaviour.
- OAuth token exchange uses the same request path as the active browser surface.

The developer of One Swagger does not receive, log or sell these requests or their contents. There is no proxy server controlled by the developer.

## What One Swagger does not collect

- No names, email addresses, accounts or passwords for One Swagger itself.
- No analytics, crash reporting or usage statistics.
- No advertising identifiers.
- No browsing history beyond the current tab URL that the extension uses when you click its toolbar button.
- No data sold or shared with third parties.

## Chrome extension permissions

- **tabs / active tab URL:** opens or focuses the One Swagger tab and can use the current page's origin to find a specification.
- **sidePanel:** provides the optional side-panel view.
- **Host permissions for all URLs (`<all_urls>`):** required because the user chooses arbitrary local or remote API and specification URLs.

The extension injects no content scripts, loads no remote code and makes no requests except those needed to load a specification or execute a request chosen by the user.

## Tampermonkey userscript

- The userscript runs on pages you visit so that its floating launcher is available. It does not read or transmit page content.
- It uses `@connect *` because the user chooses arbitrary API and specification URLs.
- It stores settings and history with `GM_getValue` / `GM_setValue`, or browser local storage if Tampermonkey storage is unavailable.
- It injects the app into an isolated shadow root. It does not modify the page's DOM outside that overlay.

## Data retention and deletion

All stored data is local to your browser profile.

- Use **Clear history** in the History drawer to delete request history.
- Use **Clear all** in the Authorize dialog to remove stored API credentials.
- Use **Close** on the current spec card to stop remembering the last spec URL.
- Removing the extension, removing the userscript, or clearing its stored data removes all of its local storage.

## Children's privacy

One Swagger is a developer tool and is not directed at children. It does not knowingly collect personal information from anyone.

## Changes

Material changes to this policy will be published in this repository and, where relevant, in the Chrome Web Store listing.

## Contact

For privacy questions, open an issue at the project's GitHub repository:

https://github.com/anikethana21/one-swagger-v2/issues
