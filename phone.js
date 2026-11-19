const byId = (id) => document.getElementById(id);
const login = byId('login');
const phone = byId('phone');
const region = byId('region');
const clientId = byId('client-id');
const number = byId('number');
const status = byId('status');
const speaker = byId('speaker');
const callback = new URL('./', import.meta.url).href;
const transactionKey = 'genesys-webrtc-pkce';
const environments = {
  'US East': 'mypurecloud.com', 'US West': 'usw2.pure.cloud',
  'Canada': 'cac1.pure.cloud', 'São Paulo': 'sae1.pure.cloud',
  'Mexico': 'mxc1.pure.cloud', 'Ireland': 'mypurecloud.ie',
  'Frankfurt': 'mypurecloud.de', 'London': 'euw2.pure.cloud',
  'Zurich': 'euc2.pure.cloud', 'UAE': 'mec1.pure.cloud',
  'Mumbai': 'aps1.pure.cloud', 'Singapore': 'apse1.pure.cloud',
  'Sydney': 'mypurecloud.com.au', 'Tokyo': 'mypurecloud.jp',
  'Seoul': 'apne2.pure.cloud', 'Osaka': 'apne3.pure.cloud',
};
const regions = new Set(Object.values(environments));

for (const [name, domain] of Object.entries(environments)) {
  region.add(new Option(name, domain));
}
byId('callback').value = callback;
byId('callback').addEventListener('focus', (event) => event.target.select());

let auth;
let sdk;
let online = false;
let busy = false;
let call;
let expiryTimer;
const earlyProposals = new Map();
const earlyEnds = new Set();

function render(message) {
  if (message) status.textContent = message;
  login.hidden = Boolean(auth);
  phone.hidden = !auth;
  byId('sign-in').disabled = busy;
  byId('enable').hidden = Boolean(sdk);
  byId('enable').disabled = busy;
  byId('sign-out').disabled = busy || Boolean(call);
  const ready = online && Boolean(sdk?.station);
  number.disabled = busy || !ready || Boolean(call);
  byId('call').disabled = number.disabled;
  byId('answer').disabled = busy || !online || call?.phase !== 'incoming';
  byId('hang-up').disabled = busy || !online || !call?.id;
  byId('mute').disabled = busy || !online || call?.phase !== 'connected';
  byId('mute').textContent = call?.muted ? 'Unmute' : 'Mute';
  byId('mute').setAttribute('aria-pressed', String(Boolean(call?.muted)));
}

async function run(action) {
  if (busy) return;
  busy = true;
  render();
  try {
    await action();
  } catch (error) {
    render(error instanceof Error ? error.message : 'The phone operation failed. Try again.');
  } finally {
    busy = false;
    render();
  }
}

function encode(bytes) {
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function random() {
  return encode(crypto.getRandomValues(new Uint8Array(32)));
}

login.addEventListener('submit', (event) => {
  event.preventDefault();
  void run(async () => {
    if (!window.isSecureContext) throw new Error('Open the phone over HTTPS or localhost.');
    const client = clientId.value.trim();
    const domain = region.value;
    if (!client || !regions.has(domain)) throw new Error('Choose a region and enter your OAuth client ID.');
    const verifier = random();
    const state = random();
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    sessionStorage.setItem(transactionKey, JSON.stringify({
      verifier, state, client, domain, expires: Date.now() + 600_000,
    }));
    const url = new URL('https://login.' + domain + '/oauth/authorize');
    url.search = new URLSearchParams({
      client_id: client, response_type: 'code', redirect_uri: callback, state,
      code_challenge_method: 'S256', code_challenge: encode(new Uint8Array(digest)),
    });
    location.assign(url);
  });
});

async function completeLogin(query) {
  const saved = JSON.parse(sessionStorage.getItem(transactionKey));
  sessionStorage.removeItem(transactionKey);
  if (!saved || Date.now() >= saved.expires || !regions.has(saved.domain)
      || query.getAll('state').length !== 1 || query.get('state') !== saved.state) {
    throw new Error('Sign-in expired or could not be verified. Start again.');
  }
  clientId.value = saved.client;
  region.value = saved.domain;
  if (query.has('error') || query.getAll('code').length !== 1 || !query.get('code')) {
    throw new Error('Genesys Cloud did not complete sign-in. Check the OAuth client and callback URL.');
  }
  const response = await fetch('https://login.' + saved.domain + '/oauth/token', {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(20_000),
    body: new URLSearchParams({
      grant_type: 'authorization_code', client_id: saved.client, redirect_uri: callback,
      code: query.get('code'), code_verifier: saved.verifier,
    }),
  });
  if (!response.ok) throw new Error('Genesys token exchange failed (HTTP ' + response.status + ').');
  const token = await response.json();
  if (typeof token.access_token !== 'string' || !token.access_token || !Number.isFinite(token.expires_in) || token.expires_in <= 0) {
    throw new Error('Genesys Cloud returned an invalid token.');
  }
  auth = { token: token.access_token, domain: saved.domain };
  expiryTimer = setTimeout(() => { void signOut('Sign-in expired. Sign in again.').catch(() => {}); },
    Math.min(token.expires_in * 1000, 2_147_483_647));
  render('Signed in. Enable the phone to use your microphone.');
}

function readyMessage() {
  if (!sdk?.station) return 'Select a Genesys Cloud WebRTC phone in your organization, then return here.';
  return 'Ready · ' + (sdk.station.name || 'WebRTC station');
}

function clearCall(message = readyMessage()) {
  call = undefined;
  render(message);
}

function accept(proposal) {
  return sdk.acceptPendingSession({ conversationId: proposal.conversationId, fromHeadset: false });
}

function acceptOutgoing(proposal) {
  const current = call;
  current.proposal = proposal;
  void accept(proposal).catch(() => {
    if (call === current) render('Could not connect call audio. Hang up and try again.');
  });
}

function wireEvents(instance) {
  const listen = (name, handler) => instance.on(name, (...args) => {
    if (sdk === instance) handler(...args);
  });
  listen('pendingSession', (proposal) => {
    if (!proposal.conversationId || proposal.sessionType !== 'softphone') return;
    if (call?.phase === 'dialing' && !call.id) {
      earlyProposals.set(proposal.conversationId, proposal);
      return;
    }
    if (call?.phase === 'dialing' && call.id === proposal.conversationId && !call.proposal) {
      acceptOutgoing(proposal);
    } else if (!call) {
      call = { id: proposal.conversationId, phase: 'incoming', proposal };
      render('Incoming call');
    }
  });
  const matches = (event) => call && (
    (call.id && call.id === event.conversationId)
    || (call.proposal && call.proposal.sessionId === event.sessionId)
  );
  const ended = (event) => {
    if (matches(event)) clearCall('Call ended.');
    else if (call?.phase === 'dialing' && !call.id && event.conversationId) {
      earlyEnds.add(event.conversationId);
    }
  };
  listen('cancelPendingSession', ended);
  listen('handledPendingSession', (event) => {
    if (call?.phase === 'incoming' && matches(event)) clearCall('Call handled on another device.');
  });
  listen('sessionEnded', (session) => ended({ conversationId: session.conversationId, sessionId: session.id }));
  listen('conversationUpdate', ({ current, removed }) => {
    for (const entry of removed) ended(entry);
    const entry = current.find((item) => item.conversationId === call?.id);
    if (entry?.mostRecentCallState?.state === 'connected' && call.phase !== 'incoming') {
      call.phase = 'connected';
      call.muted = Boolean(entry.mostRecentCallState.muted);
      render('Call connected.');
    }
  });
  listen('station', () => render(call ? undefined : readyMessage()));
  listen('connected', () => {
    online = true;
    render(call ? undefined : readyMessage());
  });
  listen('disconnected', (_info, { reconnecting } = {}) => {
    online = false;
    render(reconnecting ? 'Reconnecting to Genesys Cloud…' : 'Phone disconnected. Sign out and reconnect.');
    if (!reconnecting) clearCall('Phone disconnected. Sign out and reconnect.');
  });
  listen('sdkError', () => render('Genesys reported a phone error. Check your station and permissions.'));
}

byId('enable').addEventListener('click', () => void run(async () => {
  const Sdk = window.GenesysCloudWebrtcSdk?.GenesysCloudWebrtcSdk;
  if (!Sdk) throw new Error('The Genesys WebRTC SDK could not load. Check access to the SDK CDN and reload.');
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone access requires HTTPS or localhost.');
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  for (const track of stream.getTracks()) track.stop();
  if (!auth) return;
  const instance = new Sdk({
    accessToken: auth.token, environment: auth.domain, allowedSessionTypes: ['softphone'],
    autoConnectSessions: true, disableAutoAnswer: true, useHeadsets: false, defaults: { audioElement: speaker },
  });
  sdk = instance;
  wireEvents(instance);
  try {
    await instance.initialize();
    if (instance !== sdk) return;
    online = true;
    render(readyMessage());
  } catch {
    if (sdk === instance) {
      sdk = undefined;
      online = false;
      await instance.destroy().catch(() => {});
      throw new Error('Could not connect the phone. Check the region, OAuth scopes, and Genesys permissions.');
    }
  }
}));

byId('dial').addEventListener('submit', (event) => {
  event.preventDefault();
  if (!online || !sdk?.station || call) return;
  void run(async () => {
    const destination = number.value.trim().replace(/[ ().-]/g, '');
    if (!/^\+?[0-9*#]{1,32}$/.test(destination)) throw new Error('Enter a valid phone number or extension.');
    const outgoing = { phase: 'dialing' };
    call = outgoing;
    render('Dialing…');
    try {
      const result = await sdk.startSoftphoneSession({ phoneNumber: destination });
      if (call !== outgoing) return;
      outgoing.id = result.id;
      if (earlyEnds.has(result.id)) {
        clearCall('Call ended.');
        return;
      }
      const proposal = earlyProposals.get(result.id);
      if (proposal) acceptOutgoing(proposal);
    } catch (error) {
      if (call === outgoing) clearCall();
      throw error;
    } finally {
      earlyProposals.clear();
      earlyEnds.clear();
    }
  });
});

byId('answer').addEventListener('click', () => {
  if (!online || call?.phase !== 'incoming') return;
  void run(async () => {
    const incoming = call;
    incoming.phase = 'answering';
    render('Connecting audio…');
    try {
      await accept(incoming.proposal);
    } catch (error) {
      if (call === incoming) incoming.phase = 'incoming';
      throw error;
    }
  });
});

async function platformRequest(path, options = {}) {
  const response = await fetch('https://api.' + auth.domain + '/api/v2' + path, {
    ...options, redirect: 'error', signal: AbortSignal.timeout(15_000),
    headers: { Authorization: 'Bearer ' + auth.token, ...options.headers },
  });
  if (!response.ok) throw new Error('Call control failed (HTTP ' + response.status + ').');
  if (response.status !== 204 && options.method !== 'PATCH') return response.json();
}

async function cancelDialing(conversationId) {
  const path = '/conversations/calls/' + encodeURIComponent(conversationId);
  const [me, conversation] = await Promise.all([
    platformRequest('/users/me'), platformRequest(path),
  ]);
  const participant = conversation.participants?.find((item) => item.userId === me.id && item.purpose !== 'voicemail');
  if (!participant?.id) throw new Error('Still establishing the call. Try Hang up again in a moment.');
  await platformRequest(path + '/participants/' + encodeURIComponent(participant.id), {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state: 'disconnected' }),
  });
}

byId('hang-up').addEventListener('click', () => {
  if (!online || !call?.id) return;
  void run(async () => {
    const current = call;
    const options = { conversationId: current.id, fromHeadset: false };
    if (current.phase === 'incoming') await sdk.rejectPendingSession(options);
    else if (current.phase === 'dialing') await cancelDialing(current.id);
    else await sdk.endSession(options);
    if (call === current) clearCall('Call ended.');
  });
});

byId('mute').addEventListener('click', () => {
  if (!online || call?.phase !== 'connected') return;
  void run(async () => {
    const current = call;
    const mute = !current.muted;
    await sdk.setAudioMute({ conversationId: current.id, mute, fromHeadset: false });
    if (call === current) current.muted = mute;
  });
});

async function signOut(message) {
  clearTimeout(expiryTimer);
  const instance = sdk;
  sdk = undefined;
  auth = undefined;
  online = false;
  earlyProposals.clear();
  earlyEnds.clear();
  clearCall(message);
  if (instance) await instance.destroy();
  speaker.srcObject = null;
}

byId('sign-out').addEventListener('click', () => void run(() => signOut('Signed out of the phone.')));

render();
const query = new URLSearchParams(location.search);
if (query.has('code') || query.has('error') || query.has('state')) {
  history.replaceState(null, '', callback);
  void run(() => completeLogin(query));
}
