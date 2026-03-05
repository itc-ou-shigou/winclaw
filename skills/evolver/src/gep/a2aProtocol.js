// GEP A2A Protocol - Standard message types and pluggable transport layer.
//
// Protocol messages:
//   hello    - capability advertisement and node discovery
//   publish  - broadcast an eligible asset (Capsule/Gene)
//   fetch    - request a specific asset by id or content hash
//   report   - send a ValidationReport for a received asset
//   decision - accept/reject/quarantine decision on a received asset
//   revoke   - withdraw a previously published asset
//
// Transport interface:
//   send(message, opts)    - send a protocol message
//   receive(opts)          - receive pending messages
//   list(opts)             - list available message files/streams
//
// Default transport: FileTransport (reads/writes JSONL to a2a/ directory).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getGepAssetsDir } = require('./paths');
const { computeAssetId } = require('./contentHash');
const { captureEnvFingerprint } = require('./envFingerprint');
const os = require('os');
const { getDeviceId } = require('./deviceId');

const PROTOCOL_NAME = 'gep-a2a';
const PROTOCOL_VERSION = '1.0.0';
const VALID_MESSAGE_TYPES = ['hello', 'publish', 'fetch', 'report', 'decision', 'revoke'];

const NODE_ID_RE = /^node_[a-f0-9]{12}$/;
const NODE_ID_DIR = path.join(os.homedir(), '.evomap');
const NODE_ID_FILE = path.join(NODE_ID_DIR, 'node_id');
const LOCAL_NODE_ID_FILE = path.resolve(__dirname, '..', '..', '.evomap_node_id');

let _cachedNodeId = null;

function _loadPersistedNodeId() {
  try {
    if (fs.existsSync(NODE_ID_FILE)) {
      const id = fs.readFileSync(NODE_ID_FILE, 'utf8').trim();
      if (id && NODE_ID_RE.test(id)) return id;
    }
  } catch {}
  try {
    if (fs.existsSync(LOCAL_NODE_ID_FILE)) {
      const id = fs.readFileSync(LOCAL_NODE_ID_FILE, 'utf8').trim();
      if (id && NODE_ID_RE.test(id)) return id;
    }
  } catch {}
  return null;
}

function _persistNodeId(id) {
  try {
    if (!fs.existsSync(NODE_ID_DIR)) {
      fs.mkdirSync(NODE_ID_DIR, { recursive: true, mode: 0o700 });
    }
    fs.writeFileSync(NODE_ID_FILE, id, { encoding: 'utf8', mode: 0o600 });
    return;
  } catch {}
  try {
    fs.writeFileSync(LOCAL_NODE_ID_FILE, id, { encoding: 'utf8', mode: 0o600 });
    return;
  } catch {}
}

function generateMessageId() {
  return 'msg_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
}

function getNodeId() {
  if (_cachedNodeId) return _cachedNodeId;

  if (process.env.A2A_NODE_ID) {
    _cachedNodeId = String(process.env.A2A_NODE_ID);
    return _cachedNodeId;
  }

  const persisted = _loadPersistedNodeId();
  if (persisted) {
    _cachedNodeId = persisted;
    return _cachedNodeId;
  }

  const deviceId = getDeviceId();
  const agentName = process.env.AGENT_NAME || 'default';
  const raw = deviceId + '|' + agentName + '|' + process.cwd();
  const computed = 'node_' + crypto.createHash('sha256').update(raw).digest('hex').slice(0, 12);

  _persistNodeId(computed);
  _cachedNodeId = computed;
  return _cachedNodeId;
}

// --- Base message builder ---

function buildMessage(params) {
  var messageType = params.messageType;
  var payload = params.payload;
  var senderId = params.senderId;
  if (!VALID_MESSAGE_TYPES.includes(messageType)) {
    throw new Error('Invalid message type: ' + messageType + '. Valid: ' + VALID_MESSAGE_TYPES.join(', '));
  }
  return {
    protocol: PROTOCOL_NAME,
    protocol_version: PROTOCOL_VERSION,
    message_type: messageType,
    message_id: generateMessageId(),
    sender_id: senderId || getNodeId(),
    timestamp: new Date().toISOString(),
    payload: payload || {},
  };
}

// --- Typed message builders ---

function buildHello(opts) {
  var o = opts || {};
  return buildMessage({
    messageType: 'hello',
    senderId: o.nodeId,
    payload: {
      capabilities: o.capabilities || {},
      gene_count: typeof o.geneCount === 'number' ? o.geneCount : null,
      capsule_count: typeof o.capsuleCount === 'number' ? o.capsuleCount : null,
      env_fingerprint: captureEnvFingerprint(),
    },
  });
}

function buildPublish(opts) {
  var o = opts || {};
  var asset = o.asset;
  if (!asset || !asset.type || !asset.id) {
    throw new Error('publish: asset must have type and id');
  }
  // Generate signature: HMAC-SHA256 of asset_id with node secret
  var assetIdVal = asset.asset_id || computeAssetId(asset);
  var nodeSecret = process.env.A2A_NODE_SECRET || getNodeId();
  var signature = crypto.createHmac('sha256', nodeSecret).update(assetIdVal).digest('hex');
  return buildMessage({
    messageType: 'publish',
    senderId: o.nodeId,
    payload: {
      asset_type: asset.type,
      asset_id: assetIdVal,
      local_id: asset.id,
      asset: asset,
      signature: signature,
    },
  });
}

// Build a bundle publish message containing Gene + Capsule (+ optional EvolutionEvent).
// Hub requires payload.assets = [Gene, Capsule] since bundle enforcement was added.
function buildPublishBundle(opts) {
  var o = opts || {};
  var gene = o.gene;
  var capsule = o.capsule;
  var event = o.event || null;
  if (!gene || gene.type !== 'Gene' || !gene.id) {
    throw new Error('publishBundle: gene must be a valid Gene with type and id');
  }
  if (!capsule || capsule.type !== 'Capsule' || !capsule.id) {
    throw new Error('publishBundle: capsule must be a valid Capsule with type and id');
  }
  var geneAssetId = gene.asset_id || computeAssetId(gene);
  var capsuleAssetId = capsule.asset_id || computeAssetId(capsule);
  var nodeSecret = process.env.A2A_NODE_SECRET || getNodeId();
  var signatureInput = [geneAssetId, capsuleAssetId].sort().join('|');
  var signature = crypto.createHmac('sha256', nodeSecret).update(signatureInput).digest('hex');
  if (o.modelName && typeof o.modelName === 'string') {
    gene.model_name = o.modelName;
    capsule.model_name = o.modelName;
  }
  var assets = [gene, capsule];
  if (event && event.type === 'EvolutionEvent') {
    if (o.modelName && typeof o.modelName === 'string') {
      event.model_name = o.modelName;
    }
    assets.push(event);
  }
  var publishPayload = {
    assets: assets,
    signature: signature,
  };
  if (o.chainId && typeof o.chainId === 'string') {
    publishPayload.chain_id = o.chainId;
  }
  return buildMessage({
    messageType: 'publish',
    senderId: o.nodeId,
    payload: publishPayload,
  });
}

function buildFetch(opts) {
  var o = opts || {};
  return buildMessage({
    messageType: 'fetch',
    senderId: o.nodeId,
    payload: {
      asset_type: o.assetType || null,
      local_id: o.localId || null,
      content_hash: o.contentHash || null,
    },
  });
}

function buildReport(opts) {
  var o = opts || {};
  return buildMessage({
    messageType: 'report',
    senderId: o.nodeId,
    payload: {
      target_asset_id: o.assetId || null,
      target_local_id: o.localId || null,
      validation_report: o.validationReport || null,
    },
  });
}

function buildDecision(opts) {
  var o = opts || {};
  var validDecisions = ['accept', 'reject', 'quarantine'];
  if (!validDecisions.includes(o.decision)) {
    throw new Error('decision must be one of: ' + validDecisions.join(', '));
  }
  return buildMessage({
    messageType: 'decision',
    senderId: o.nodeId,
    payload: {
      target_asset_id: o.assetId || null,
      target_local_id: o.localId || null,
      decision: o.decision,
      reason: o.reason || null,
    },
  });
}

function buildRevoke(opts) {
  var o = opts || {};
  return buildMessage({
    messageType: 'revoke',
    senderId: o.nodeId,
    payload: {
      target_asset_id: o.assetId || null,
      target_local_id: o.localId || null,
      reason: o.reason || null,
    },
  });
}

// --- Validation ---

function isValidProtocolMessage(msg) {
  if (!msg || typeof msg !== 'object') return false;
  if (msg.protocol !== PROTOCOL_NAME) return false;
  if (!msg.message_type || !VALID_MESSAGE_TYPES.includes(msg.message_type)) return false;
  if (!msg.message_id || typeof msg.message_id !== 'string') return false;
  if (!msg.timestamp || typeof msg.timestamp !== 'string') return false;
  return true;
}

// Try to extract a raw asset from either a protocol message or a plain asset object.
// This enables backward-compatible ingestion of both old-format and new-format payloads.
function unwrapAssetFromMessage(input) {
  if (!input || typeof input !== 'object') return null;
  // If it is a protocol message with a publish payload, extract the asset.
  if (input.protocol === PROTOCOL_NAME && input.message_type === 'publish') {
    var p = input.payload;
    if (p && p.asset && typeof p.asset === 'object') return p.asset;
    return null;
  }
  // If it is a plain asset (Gene/Capsule/EvolutionEvent), return as-is.
  if (input.type === 'Gene' || input.type === 'Capsule' || input.type === 'EvolutionEvent') {
    return input;
  }
  return null;
}

// --- File Transport ---

function ensureDir(dir) {
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch (e) {}
}

function defaultA2ADir() {
  return process.env.A2A_DIR || path.join(getGepAssetsDir(), 'a2a');
}

function fileTransportSend(message, opts) {
  var dir = (opts && opts.dir) || defaultA2ADir();
  var subdir = path.join(dir, 'outbox');
  ensureDir(subdir);
  var filePath = path.join(subdir, message.message_type + '.jsonl');
  fs.appendFileSync(filePath, JSON.stringify(message) + '\n', 'utf8');
  return { ok: true, path: filePath };
}

function fileTransportReceive(opts) {
  var dir = (opts && opts.dir) || defaultA2ADir();
  var subdir = path.join(dir, 'inbox');
  if (!fs.existsSync(subdir)) return [];
  var files = fs.readdirSync(subdir).filter(function (f) { return f.endsWith('.jsonl'); });
  var messages = [];
  for (var fi = 0; fi < files.length; fi++) {
    try {
      var raw = fs.readFileSync(path.join(subdir, files[fi]), 'utf8');
      var lines = raw.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
      for (var li = 0; li < lines.length; li++) {
        try {
          var msg = JSON.parse(lines[li]);
          if (msg && msg.protocol === PROTOCOL_NAME) messages.push(msg);
        } catch (e) {}
      }
    } catch (e) {}
  }
  return messages;
}

function fileTransportList(opts) {
  var dir = (opts && opts.dir) || defaultA2ADir();
  var subdir = path.join(dir, 'outbox');
  if (!fs.existsSync(subdir)) return [];
  return fs.readdirSync(subdir).filter(function (f) { return f.endsWith('.jsonl'); });
}

// --- HTTP Transport (connects to evomap-hub) ---

function httpTransportSend(message, opts) {
  var hubUrl = (opts && opts.hubUrl) || process.env.A2A_HUB_URL;
  if (!hubUrl) return { ok: false, error: 'A2A_HUB_URL not set' };
  var endpoint = hubUrl.replace(/\/+$/, '') + '/a2a/' + message.message_type;
  var body = JSON.stringify(message);
  // Use dynamic import for fetch (available in Node 18+)
  return fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body,
  })
    .then(function (res) { return res.json(); })
    .then(function (data) { return { ok: true, response: data }; })
    .catch(function (err) { return { ok: false, error: err.message }; });
}

function httpTransportReceive(opts) {
  var hubUrl = (opts && opts.hubUrl) || process.env.A2A_HUB_URL;
  if (!hubUrl) return Promise.resolve([]);
  var assetType = (opts && opts.assetType) || null;
  var fetchMsg = buildFetch({ assetType: assetType });
  var endpoint = hubUrl.replace(/\/+$/, '') + '/a2a/fetch';
  return fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fetchMsg),
  })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (data && data.payload && Array.isArray(data.payload.results)) {
        return data.payload.results;
      }
      return [];
    })
    .catch(function () { return []; });
}

function httpTransportList() {
  return ['http'];
}

// --- Heartbeat ---

var _heartbeatTimer = null;
var _heartbeatStartedAt = null;
var _heartbeatConsecutiveFailures = 0;
var _heartbeatTotalSent = 0;
var _heartbeatTotalFailed = 0;

function getHubUrl() {
  return process.env.A2A_HUB_URL || process.env.EVOMAP_HUB_URL || '';
}

function sendHelloToHub() {
  var hubUrl = getHubUrl();
  if (!hubUrl) return Promise.resolve({ ok: false, error: 'no_hub_url' });

  var endpoint = hubUrl.replace(/\/+$/, '') + '/a2a/hello';
  var nodeId = getNodeId();
  var msg = buildHello({ nodeId: nodeId, capabilities: {} });
  msg.sender_id = nodeId;

  return fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(msg),
    signal: AbortSignal.timeout(15000),
  })
    .then(function (res) { return res.json(); })
    .then(function (data) { return { ok: true, response: data }; })
    .catch(function (err) { return { ok: false, error: err.message }; });
}

function sendHeartbeat() {
  var hubUrl = getHubUrl();
  if (!hubUrl) return Promise.resolve({ ok: false, error: 'no_hub_url' });

  var endpoint = hubUrl.replace(/\/+$/, '') + '/a2a/heartbeat';
  var nodeId = getNodeId();
  var body = JSON.stringify({
    node_id: nodeId,
    sender_id: nodeId,
    version: PROTOCOL_VERSION,
    uptime_ms: _heartbeatStartedAt ? Date.now() - _heartbeatStartedAt : 0,
    timestamp: new Date().toISOString(),
  });

  _heartbeatTotalSent++;

  return fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body,
    signal: AbortSignal.timeout(10000),
  })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (data && data.status === 'unknown_node') {
        console.warn('[Heartbeat] Node not registered on hub. Sending hello to re-register...');
        return sendHelloToHub().then(function (helloResult) {
          if (helloResult.ok) {
            console.log('[Heartbeat] Re-registered with hub successfully.');
            _heartbeatConsecutiveFailures = 0;
          } else {
            console.warn('[Heartbeat] Re-registration failed: ' + (helloResult.error || 'unknown'));
          }
          return { ok: helloResult.ok, response: data, reregistered: helloResult.ok };
        });
      }
      _heartbeatConsecutiveFailures = 0;
      return { ok: true, response: data };
    })
    .catch(function (err) {
      _heartbeatConsecutiveFailures++;
      _heartbeatTotalFailed++;
      if (_heartbeatConsecutiveFailures === 3) {
        console.warn('[Heartbeat] 3 consecutive failures. Network issue? Last error: ' + err.message);
      } else if (_heartbeatConsecutiveFailures === 10) {
        console.warn('[Heartbeat] 10 consecutive failures. Hub may be unreachable. (' + err.message + ')');
      } else if (_heartbeatConsecutiveFailures % 50 === 0) {
        console.warn('[Heartbeat] ' + _heartbeatConsecutiveFailures + ' consecutive failures. (' + err.message + ')');
      }
      return { ok: false, error: err.message };
    });
}

function startHeartbeat(intervalMs) {
  if (_heartbeatTimer) return;
  var interval = intervalMs || Number(process.env.HEARTBEAT_INTERVAL_MS) || 120000; // default 2min
  _heartbeatStartedAt = Date.now();

  // Register with hub first (hello), then start heartbeat loop
  sendHelloToHub().then(function (r) {
    if (r.ok) console.log('[Heartbeat] Registered with hub. Node: ' + getNodeId());
    else console.warn('[Heartbeat] Hello failed (will retry via heartbeat): ' + (r.error || 'unknown'));
  }).catch(function () {});

  // First heartbeat after a short delay (let hello complete first)
  setTimeout(function () {
    sendHeartbeat().then(function (r) {
      if (r.ok) console.log('[Heartbeat] Connected to hub. Node: ' + getNodeId());
    }).catch(function () {});
  }, 5000);

  _heartbeatTimer = setInterval(function () {
    sendHeartbeat().catch(function () {});
  }, interval);

  if (_heartbeatTimer.unref) _heartbeatTimer.unref();
}

function stopHeartbeat() {
  if (_heartbeatTimer) {
    clearInterval(_heartbeatTimer);
    _heartbeatTimer = null;
  }
}

function getHeartbeatStats() {
  return {
    running: !!_heartbeatTimer,
    uptimeMs: _heartbeatStartedAt ? Date.now() - _heartbeatStartedAt : 0,
    totalSent: _heartbeatTotalSent,
    totalFailed: _heartbeatTotalFailed,
    consecutiveFailures: _heartbeatConsecutiveFailures,
  };
}

// --- GRC HTTP Transport ---

/**
 * GRC HTTP Transport — sends A2A messages to the Global Resource Center.
 * Supports: hello, publish, fetch, report, decision, revoke, heartbeat
 *
 * Features:
 *  - Exponential-backoff retry on network errors
 *  - Offline queue: messages are held in memory when GRC is unreachable
 *    and replayed automatically on the next successful connection
 *  - 15-second per-request timeout via AbortController
 */
class GrcTransport {
  /**
   * @param {string} grcUrl   - GRC server base URL (trailing slashes are stripped)
   * @param {string|null} authToken - Bearer token for Authorization header
   */
  constructor(grcUrl, authToken) {
    this.grcUrl = grcUrl.replace(/\/+$/, '');
    this.authToken = authToken || null;
    this.retryConfig = {
      maxRetries: 5,
      initialDelayMs: 1000,
      maxDelayMs: 60000,
    };
    this.offlineQueue = []; // Queue for messages when GRC is unreachable
    this.maxQueueSize = 500; // Prevent unbounded memory growth
  }

  /**
   * Update the Bearer token used for all requests.
   * @param {string} token
   */
  setAuthToken(token) {
    this.authToken = token;
  }

  /**
   * Send an A2A protocol message to the GRC.
   * On network failure the message is queued for later delivery.
   * @param {{ type: string, payload: object }} message
   * @returns {Promise<object>}
   */
  async send(message) {
    var type = message.type;
    var payload = message.payload;
    var endpoint = this._getEndpoint(type);
    if (!endpoint) {
      throw new Error('GRC transport: unsupported message type: ' + type);
    }

    try {
      var result = await this._requestWithRetry(endpoint, payload);
      // Drain offline queue on successful connection
      if (this.offlineQueue.length > 0) {
        await this._drainOfflineQueue();
      }
      return result;
    } catch (err) {
      // Queue for later if GRC is unreachable
      if (this._isNetworkError(err)) {
        this.offlineQueue.push({ type: type, payload: payload, queuedAt: new Date().toISOString() });
        // Cap queue size to prevent unbounded memory growth; drop oldest on overflow.
        if (this.offlineQueue.length > this.maxQueueSize) {
          this.offlineQueue.shift();
        }
        console.warn('[GRC Transport] Queued ' + type + ' message for later (offline queue: ' + this.offlineQueue.length + ')');
        return { queued: true, queueSize: this.offlineQueue.length };
      }
      throw err;
    }
  }

  /**
   * Pull available assets from the GRC using the search endpoint.
   * @param {{ signals?: string[], status?: string, limit?: number }} filter
   * @returns {Promise<object[]>}
   */
  async receive(filter) {
    var f = filter || {};
    // GRC transport uses pull model via search endpoint
    var params = new URLSearchParams();
    if (f.signals) params.set('signals', f.signals.join(','));
    if (f.status) params.set('status', f.status);
    if (f.limit) params.set('limit', String(f.limit));

    var url = this.grcUrl + '/a2a/assets/search?' + params.toString();
    var res = await this._fetch(url);
    return res.assets || [];
  }

  /**
   * Map message type to GRC endpoint path.
   * @param {string} type
   * @returns {string|null}
   */
  _getEndpoint(type) {
    var endpoints = {
      hello: '/a2a/hello',
      publish: '/a2a/publish',
      fetch: '/a2a/fetch',
      report: '/a2a/report',
      decision: '/a2a/decision',
      revoke: '/a2a/revoke',
      heartbeat: '/a2a/heartbeat',
    };
    return endpoints[type] || null;
  }

  /**
   * POST to endpoint with exponential-backoff retry on network errors.
   * @param {string} endpoint
   * @param {object} body
   * @param {number} attempt
   * @returns {Promise<object>}
   */
  async _requestWithRetry(endpoint, body, attempt) {
    var att = attempt || 0;
    try {
      return await this._fetch(this.grcUrl + endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (err) {
      if (att < this.retryConfig.maxRetries && this._isNetworkError(err)) {
        var delay = Math.min(
          this.retryConfig.initialDelayMs * Math.pow(2, att),
          this.retryConfig.maxDelayMs
        );
        console.warn('[GRC Transport] Retry ' + (att + 1) + '/' + this.retryConfig.maxRetries + ' in ' + delay + 'ms');
        await new Promise(function (r) { setTimeout(r, delay); });
        return this._requestWithRetry(endpoint, body, att + 1);
      }
      throw err;
    }
  }

  /**
   * Thin fetch wrapper: injects auth header, enforces 15-second timeout,
   * and throws on non-2xx responses.
   * @param {string} url
   * @param {object} opts
   * @returns {Promise<object>}
   */
  async _fetch(url, opts) {
    var o = opts || {};
    var headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'WinClaw-A2A/1.0',
    };
    if (this.authToken) {
      headers['Authorization'] = 'Bearer ' + this.authToken;
    }

    var controller = new AbortController();
    var timeoutId = setTimeout(function () { controller.abort(); }, 15000);

    try {
      var extraHeaders = o.headers || {};
      var mergedHeaders = Object.assign({}, headers, extraHeaders);
      var res = await fetch(url, Object.assign({}, o, {
        headers: mergedHeaders,
        signal: controller.signal,
      }));
      if (!res.ok) {
        var text = '';
        try { text = await res.text(); } catch (_e) {}
        var httpErr = new Error('GRC API ' + res.status + ': ' + text);
        httpErr.statusCode = res.status;
        throw httpErr;
      }
      return await res.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Return true when the error is a transient network problem.
   * @param {Error} err
   * @returns {boolean}
   */
  _isNetworkError(err) {
    if (err.name === 'AbortError') return true;
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT') return true;
    if (err.message && err.message.includes('fetch failed')) return true;
    return false;
  }

  /**
   * Attempt to replay all queued messages.  Failed messages are re-queued.
   * @returns {Promise<void>}
   */
  async _drainOfflineQueue() {
    var queue = this.offlineQueue.slice();
    this.offlineQueue = [];
    var drained = 0;
    for (var i = 0; i < queue.length; i++) {
      var item = queue[i];
      try {
        var endpoint = this._getEndpoint(item.type);
        if (endpoint) {
          await this._fetch(this.grcUrl + endpoint, {
            method: 'POST',
            body: JSON.stringify(item.payload),
          });
          drained++;
        }
      } catch (_e) {
        // Re-queue on failure
        this.offlineQueue.push(item);
      }
    }
    if (drained > 0) {
      console.log('[GRC Transport] Drained ' + drained + ' queued messages');
    }
  }

  /**
   * Return the number of messages currently waiting in the offline queue.
   * @returns {number}
   */
  getQueueSize() {
    return this.offlineQueue.length;
  }
}

/**
 * Create a GRC transport instance.
 * @param {string} grcUrl - GRC server URL
 * @param {string|null} authToken - Bearer token for authentication
 * @returns {GrcTransport}
 */
function createGrcTransport(grcUrl, authToken) {
  return new GrcTransport(grcUrl, authToken || null);
}

// --- Transport registry ---

var transports = {
  file: {
    send: fileTransportSend,
    receive: fileTransportReceive,
    list: fileTransportList,
  },
  http: {
    send: httpTransportSend,
    receive: httpTransportReceive,
    list: httpTransportList,
  },
};

function getTransport(name) {
  var n = String(name || process.env.A2A_TRANSPORT || 'file').toLowerCase();
  var t = transports[n];
  if (!t) throw new Error('Unknown A2A transport: ' + n + '. Available: ' + Object.keys(transports).join(', '));
  return t;
}

function registerTransport(name, impl) {
  if (!name || typeof name !== 'string') throw new Error('transport name required');
  if (!impl || typeof impl.send !== 'function' || typeof impl.receive !== 'function') {
    throw new Error('transport must implement send() and receive()');
  }
  transports[name] = impl;
}

module.exports = {
  PROTOCOL_NAME,
  PROTOCOL_VERSION,
  VALID_MESSAGE_TYPES,
  getNodeId,
  buildMessage,
  buildHello,
  buildPublish,
  buildPublishBundle,
  buildFetch,
  buildReport,
  buildDecision,
  buildRevoke,
  isValidProtocolMessage,
  unwrapAssetFromMessage,
  getTransport,
  registerTransport,
  fileTransportSend,
  fileTransportReceive,
  fileTransportList,
  httpTransportSend,
  httpTransportReceive,
  httpTransportList,
  sendHeartbeat,
  sendHelloToHub,
  startHeartbeat,
  stopHeartbeat,
  getHeartbeatStats,
  GrcTransport,
  createGrcTransport,
};
