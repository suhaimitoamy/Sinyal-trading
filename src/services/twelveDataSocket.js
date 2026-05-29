// ============================================================================
// twelveDataSocket.js — Twelve Data WebSocket real-time price feed manager
// ============================================================================

export const WS_STATUS = {
  DISCONNECTED: 'Disconnected',
  CONNECTING: 'Connecting',
  CONNECTED: 'Connected',
  RECONNECTING: 'Reconnecting',
  ERROR: 'Error',
};

export class TwelveDataSocket {
  constructor() {
    /** @type {WebSocket|null} */
    this.ws = null;

    /** @type {string} */
    this.status = WS_STATUS.DISCONNECTED;

    /** @type {string|null} */
    this.apiKey = null;

    /** @type {string|null} */
    this.symbol = null;

    /** @type {number} */
    this.reconnectAttempts = 0;

    /** @type {number} */
    this.maxReconnectDelay = 30000;

    /** @type {number|null} */
    this.heartbeatInterval = null;

    /** @type {number|null} */
    this.reconnectTimeout = null;

    /** @type {Array<function>} */
    this.tickCallbacks = [];

    /** @type {Array<function>} */
    this.statusCallbacks = [];

    /** @type {Array<function>} */
    this.errorCallbacks = [];

    /** @type {boolean} */
    this.destroyed = false;
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  /** @private */
  _setStatus(newStatus) {
    if (this.status === newStatus) return;
    this.status = newStatus;
    for (const cb of this.statusCallbacks) {
      try {
        cb(newStatus);
      } catch (err) {
        console.error('[TwelveDataSocket] statusCallback error:', err);
      }
    }
  }

  /** @private */
  _emitTick(tick) {
    for (const cb of this.tickCallbacks) {
      try {
        cb(tick);
      } catch (err) {
        console.error('[TwelveDataSocket] tickCallback error:', err);
      }
    }
  }

  /** @private */
  _emitError(error) {
    for (const cb of this.errorCallbacks) {
      try {
        cb(error);
      } catch (err) {
        console.error('[TwelveDataSocket] errorCallback error:', err);
      }
    }
  }

  /** @private */
  _startHeartbeat() {
    this._stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ action: 'heartbeat' }));
        } catch {
          // Ignore — will be caught by onerror/onclose
        }
      }
    }, 10_000);
  }

  /** @private */
  _stopHeartbeat() {
    if (this.heartbeatInterval !== null) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Opens a WebSocket connection to Twelve Data and subscribes to price events.
   * @param {string} apiKey
   * @param {string} [symbol='XAU/USD']
   */
  connect(apiKey, symbol = 'XAU/USD') {
    if (this.destroyed) return;

    // Prevent duplicate connections
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING)
    ) {
      console.warn('[TwelveDataSocket] Already connected or connecting.');
      return;
    }

    this.apiKey = apiKey;
    this.symbol = symbol;
    this._setStatus(WS_STATUS.CONNECTING);

    try {
      const url = `wss://ws.twelvedata.com/v1/quotes/price?apikey=${encodeURIComponent(apiKey)}`;
      this.ws = new WebSocket(url);
    } catch (err) {
      console.error('[TwelveDataSocket] WebSocket creation failed:', err);
      this._setStatus(WS_STATUS.ERROR);
      this._emitError(err);
      this.reconnect();
      return;
    }

    // ----- onopen -----
    this.ws.onopen = () => {
      if (this.destroyed) {
        this.ws.close();
        return;
      }

      console.log('[TwelveDataSocket] Connection opened.');
      this.reconnectAttempts = 0;
      this._setStatus(WS_STATUS.CONNECTED);

      // Subscribe to the symbol
      try {
        this.ws.send(
          JSON.stringify({
            action: 'subscribe',
            params: { symbols: this.symbol },
          })
        );
      } catch (err) {
        console.error('[TwelveDataSocket] Subscribe send failed:', err);
      }

      this._startHeartbeat();
    };

    // ----- onmessage -----
    this.ws.onmessage = (messageEvent) => {
      let data;
      try {
        data = JSON.parse(messageEvent.data);
      } catch {
        console.warn('[TwelveDataSocket] Non-JSON message:', messageEvent.data);
        return;
      }

      const event = data.event;

      if (event === 'price') {
        const price = Number(data.price);
        if (!Number.isFinite(price)) return;

        const timestamp = data.timestamp ? Number(data.timestamp) : Math.floor(Date.now() / 1000);

        this._emitTick({ price, timestamp });
      } else if (event === 'subscribe-status') {
        console.log('[TwelveDataSocket] Subscribe status:', data.status, data);
        if (data.status === 'error') {
          this._emitError(new Error(data.message || 'Subscription failed'));
        }
      } else if (event === 'heartbeat') {
        // Expected — no action needed
      } else if (event === 'error' || (typeof event === 'string' && event.includes('error'))) {
        console.error('[TwelveDataSocket] Server error event:', data);
        this._emitError(new Error(data.message || JSON.stringify(data)));
      } else if (data.status === 'error') {
        // Some Twelve Data errors arrive without an `event` field
        console.error('[TwelveDataSocket] Error response:', data);
        this._emitError(new Error(data.message || JSON.stringify(data)));
      }
    };

    // ----- onclose -----
    this.ws.onclose = (closeEvent) => {
      console.log(
        `[TwelveDataSocket] Connection closed (code=${closeEvent.code}, reason=${closeEvent.reason}).`
      );
      this._stopHeartbeat();

      if (!this.destroyed) {
        this.reconnect();
      } else {
        this._setStatus(WS_STATUS.DISCONNECTED);
      }
    };

    // ----- onerror -----
    this.ws.onerror = (errorEvent) => {
      console.error('[TwelveDataSocket] WebSocket error:', errorEvent);
      this._setStatus(WS_STATUS.ERROR);
      this._emitError(new Error('WebSocket error'));
      // onclose will fire after onerror, which triggers reconnect
    };
  }

  /**
   * Reconnects with exponential back-off.
   */
  reconnect() {
    if (this.destroyed) return;
    if (this.reconnectTimeout !== null) return; // already scheduled

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), this.maxReconnectDelay);
    this.reconnectAttempts++;

    console.log(
      `[TwelveDataSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})…`
    );
    this._setStatus(WS_STATUS.RECONNECTING);

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      if (!this.destroyed && this.apiKey) {
        this.connect(this.apiKey, this.symbol);
      }
    }, delay);
  }

  /**
   * Gracefully disconnects without triggering reconnect.
   */
  disconnect() {
    this._stopHeartbeat();

    if (this.reconnectTimeout !== null) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      // Remove handlers to prevent reconnect on close
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      this.ws.onopen = null;

      if (
        this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING
      ) {
        this.ws.close();
      }
      this.ws = null;
    }

    this._setStatus(WS_STATUS.DISCONNECTED);
  }

  /**
   * Permanently tears down the socket. No reconnects will occur after this.
   */
  destroy() {
    this.destroyed = true;
    this.disconnect();
    this.tickCallbacks = [];
    this.statusCallbacks = [];
    this.errorCallbacks = [];
  }

  // -----------------------------------------------------------------------
  // Callback registration
  // -----------------------------------------------------------------------

  /** @param {function({price:number, timestamp:number}):void} callback */
  onTick(callback) {
    this.tickCallbacks.push(callback);
  }

  /** @param {function(string):void} callback */
  onStatusChange(callback) {
    this.statusCallbacks.push(callback);
  }

  /** @param {function(Error):void} callback */
  onError(callback) {
    this.errorCallbacks.push(callback);
  }

  /**
   * Returns the current connection status string.
   * @returns {string}
   */
  getStatus() {
    return this.status;
  }
}
