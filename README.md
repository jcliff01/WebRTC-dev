# Genesys Cloud WebRTC phone

A phone in your web browser for Genesys Cloud users. Sign in with your Microsoft work account, then make and answer one call at a time, hang up and mute, with the computer's microphone and speakers. Nothing to install: use Chrome or Edge (or Firefox) on Windows, macOS or Linux.

> **Status: development phone.** It handles one call at a time. Test it with a development Genesys Cloud organization and test numbers first.

**Open the phone:** [jcliff01.github.io/WebRTC-dev](https://jcliff01.github.io/WebRTC-dev/)

## For users

1. Open the phone link above. Your Genesys administrator must have set it up first (see below).
2. Click **Sign in with Microsoft** and sign in with your work account. If Genesys shows its own sign-in page, click **More Login Options**, enter your organization if asked, and choose Microsoft.
3. Click **Enable phone**, and allow the browser to use your microphone.
4. **To call:** type a number or extension and click **Call**. **To answer:** click **Answer** when a call comes in. Use **Hang up** to end a call and **Mute** to turn your microphone off and on.

Refreshing or closing the page signs you out; sign in again to continue. Close other tabs that use the same phone while you test.

| What you see | What to do |
| --- | --- |
| "Select a Genesys Cloud WebRTC phone in your organization" | In Genesys Cloud, pick your WebRTC phone as your station, then come back. |
| Calls don't connect | You need Genesys telephony permissions, a WebRTC station, and a dial plan that allows that number. Ask your administrator. |
| No sound, or the microphone is blocked | Allow the microphone in the browser's address bar (the lock or camera icon), then click **Enable phone** again. |
| Genesys asks for administrator approval | Your administrator must approve the app under **Admin → IT and Integrations → Authorized Applications**. |

## For Genesys administrators: one-time setup

1. **Microsoft sign-in.** Set up [Microsoft Entra single sign-on for Genesys Cloud](https://learn.microsoft.com/en-us/entra/identity/saas-apps/purecloud-by-genesys-tutorial) if your organization doesn't use it yet. The phone hands sign-in to Genesys, which hands it to Microsoft.
2. **OAuth client.** In Genesys Cloud, go to **Admin → IT and Integrations → OAuth** and add a client with the **Code Authorization / PKCE** grant. Under **Authorized redirect URIs**, add the phone's address exactly, including the final `/`: `https://jcliff01.github.io/WebRTC-dev/`. Give it the scopes `authorization`, `conversations`, `organizations` and `notifications`, as the [Genesys WebRTC SDK](https://github.com/MyPureCloud/genesys-cloud-webrtc-sdk/blob/develop/doc/index.md#app-authorization) requires.
3. **Tell the phone your settings.** Either way works:
   - **For everyone (recommended):** in `index.html`, fill in the `login` form's attributes: `data-region` (your region, such as `mypurecloud.com`), `data-client-id` (the OAuth Client ID), `data-org` (your Genesys Cloud organization name), and optionally `data-provider` (the key of your Microsoft sign-in provider in Genesys, to skip the Genesys sign-in page). Commit the change; GitHub Pages updates the site within a few minutes. The Client ID is a public identifier, so it is safe here. **Never put a client secret in this site.**
   - **For one browser, to test:** open **One-time app setup** on the phone page, enter the same values, and click **Save setup**.
4. Each user needs normal Genesys telephony permissions and a WebRTC phone selected as their station.

If sign-in fails before the browser comes back to the phone, check the redirect URI, Client ID, region and grant type in the OAuth client first.

## For developers

The page is plain HTML and JavaScript, with no build step. To run it on your own computer you need any web server; Python's is the simplest:

| Computer | Command, run in this folder |
| --- | --- |
| Windows | `py -m http.server 8000` (install Python with `winget install Python.Python.3.12`) |
| macOS or Linux | `python3 -m http.server 8000` |

Open http://localhost:8000/ and register `http://localhost:8000/` as a redirect URI in a development OAuth client.

How it works: the page signs in with OAuth Authorization Code + PKCE in the browser, with no server and no client secret. Tokens and call state are kept only in the page's memory. It loads the [Genesys Cloud WebRTC SDK](https://github.com/MyPureCloud/genesys-cloud-webrtc-sdk) 14.4.0 from the jsDelivr CDN, pinned with an integrity hash; the SDK has its own license.

To publish your own copy: fork this repository, then in **Settings → Pages** choose **Deploy from a branch**, branch **main**, folder **/ (root)**.

## License

[MIT](LICENSE).
