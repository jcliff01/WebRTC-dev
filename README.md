# Genesys Cloud WebRTC phone

A single-call browser phone for a signed-in Genesys Cloud user. The app uses the Genesys Cloud WebRTC SDK and OAuth Authorization Code with PKCE, with no application server or client secret.

## Setup

1. In repository Settings → Pages, choose **Deploy from a branch**, **main**, and **/ (root)** if Pages is not already configured.
2. In Genesys Cloud, create a **Code Authorization / PKCE** OAuth client. Add the exact callback displayed on the phone to **Authorized redirect URIs**. On the default GitHub Pages URL it is `https://jcliff01.github.io/WebRTC-dev/`.
3. Enable OAuth scopes `authorization`, `conversations`, `organizations`, and `notifications` as documented by the [Genesys WebRTC SDK](https://github.com/MyPureCloud/genesys-cloud-webrtc-sdk/blob/develop/doc/index.md#app-authorization). The user also needs their normal telephony permissions, a selected Genesys Cloud WebRTC station, and a site dial plan that permits the destination.
4. Open the phone over HTTPS in a supported browser. Select the organization region, enter the OAuth client ID, sign in, and select **Enable phone** to grant microphone access. Close other tabs acting as the same phone while testing.

Enter a number or extension to dial, or use **Answer** when an incoming call arrives. Use **Hang up** to end the call and **Mute** to toggle the microphone. Sign-in and call state live in memory. Refreshing requires signing in again.

For local testing, serve the repository with `python3 -m http.server 8000`. Register the callback shown at `http://localhost:8000/` with a development OAuth client.
