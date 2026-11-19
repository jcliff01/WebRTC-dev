# Genesys Cloud WebRTC phone

A single-call browser phone for a signed-in Genesys Cloud user. The app uses the Genesys Cloud WebRTC SDK and OAuth Authorization Code with PKCE, with no application server or client secret.

## Setup

1. In repository Settings → Pages, choose **Deploy from a branch**, **main**, and **/ (root)** if Pages is not already configured.
2. In Genesys Cloud, create a **Code Authorization / PKCE** OAuth client. Add the exact callback displayed on the phone to **Authorized redirect URIs**. On the default GitHub Pages URL it is `https://jcliff01.github.io/WebRTC-dev/`.
3. Enable OAuth scopes `authorization`, `conversations`, `organizations`, and `notifications` as documented by the [Genesys WebRTC SDK](https://github.com/MyPureCloud/genesys-cloud-webrtc-sdk/blob/develop/doc/index.md#app-authorization). The user also needs their normal telephony permissions, a selected Genesys Cloud WebRTC station, and a site dial plan that permits the destination.
4. For one-button sign-in on every browser, set `data-region` and `data-client-id` on the login form in `index.html` (for example `data-region="mypurecloud.com"`). The app client ID is a public identifier. Never put a client secret in the site. For a single-browser test, open **App setup**, enter the same values, and select **Save setup**. This saves only the app identifier and region in that browser.
5. Users select **Sign in with Genesys Cloud** and use their usual Genesys credentials or their organization's SSO. Then select **Enable phone** to grant microphone access. Close other tabs acting as the same phone while testing.

Enter a number or extension to dial, or use **Answer** when an incoming call arrives. Use **Hang up** to end the call and **Mute** to toggle the microphone. Access tokens and call state live in memory. Refreshing requires signing in again.

For local testing, serve the repository with `python3 -m http.server 8000`. Register the callback shown at `http://localhost:8000/` with a development OAuth client.
