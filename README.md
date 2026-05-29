<![CDATA[<div align="center">

# 📈 XAU/USD Market Structure Chart PWA

**Real-time gold price analysis with smart structure detection — right in your browser.**

[![React](https://img.shields.io/badge/React-18.3-61dafb?logo=react&logoColor=white)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-5.4-646cff?logo=vite&logoColor=white)](https://vitejs.dev)
[![TradingView](https://img.shields.io/badge/TradingView-Lightweight%20Charts%20v4-2962ff)](https://tradingview.github.io/lightweight-charts/)
[![PWA](https://img.shields.io/badge/PWA-Installable-5a0fc8?logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Deploy](https://img.shields.io/badge/Deploy-GitHub%20Pages-222?logo=github)](https://pages.github.com)

---

<!-- Replace with an actual screenshot of your running app -->
> 🖼️ *Screenshot: Add a screenshot of the app here — `![App Screenshot](./docs/screenshot.png)`*

</div>

---

## 🌟 Project Overview

**XAU/USD Market Structure Chart** is a client-side Progressive Web App that streams live gold price ticks via the [Twelve Data](https://twelvedata.com) WebSocket API and renders professional-grade candlestick charts with automated market structure analysis.

Everything runs in the browser — no backend, no server, no broker connection.

### ✨ Key Features

- 🕯️ **Real-time candlestick chart** powered by TradingView Lightweight Charts v4
- ⚡ **Live WebSocket streaming** — tick-by-tick XAU/USD price data from Twelve Data
- 🧱 **Multi-timeframe candle building** — M1, M5, M15, H1 constructed from raw ticks
- 🔺 **Swing High / Swing Low detection** — fractal pivot algorithm with configurable strength
- 🧹 **Sweep detection** — identifies liquidity grabs (wick pierces, body closes inside)
- 🔀 **BOS & CHoCH labeling** — automatic Break of Structure and Change of Character signals
- 💥 **Breakout detection** — close beyond key level and holds
- 🎯 **Session levels** — visual reference for key trading sessions
- 🔔 **Alert history** — persistent signal log stored in IndexedDB
- ⚙️ **Configurable settings** — API key, swing strength, colors — saved in localStorage
- 📱 **Installable PWA** — works offline, add to home screen on mobile
- 🚀 **Static deployment** — optimized for GitHub Pages (no server required)

### 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| UI Framework | React 18 |
| Build Tool | Vite 5 |
| Charting | TradingView Lightweight Charts v4 |
| Date/Time | Luxon |
| Persistence | IndexedDB + localStorage |
| Deployment | GitHub Pages (`gh-pages`) |
| App Model | Progressive Web App (Service Worker) |

---

## 📥 How to Install

**Prerequisites:** [Node.js](https://nodejs.org) ≥ 18 and npm ≥ 9.

```bash
# Clone the repository
git clone https://github.com/<your-username>/Sinyal-trading.git

# Navigate into the project
cd Sinyal-trading

# Install dependencies
npm install
```

> [!NOTE]
> There is **no backend** to set up. All dependencies are front-end only.

---

## 🚀 How to Run Locally

```bash
npm run dev
```

Vite will start a dev server on **http://localhost:3000** and automatically open your browser.

```
  VITE v5.4.x  ready in 300ms

  ➜  Local:   http://localhost:3000/Sinyal-trading/
  ➜  Network: http://192.168.x.x:3000/Sinyal-trading/
```

> [!TIP]
> Hot Module Replacement (HMR) is enabled — edits to React components reflect instantly without a full page reload.

---

## 🏗️ How to Build

Generate an optimized production bundle in the `dist/` directory:

```bash
npm run build
```

To preview the production build locally:

```bash
npm run preview
```

The output in `dist/` is a fully static site — HTML, JS, and CSS — ready for any static hosting provider.

---

## 🌐 How to Deploy to GitHub Pages

### Option A: Automated (recommended)

The project includes the [`gh-pages`](https://www.npmjs.com/package/gh-pages) package. Just run:

```bash
npm run deploy
```

This will:
1. Build the project (`vite build`)
2. Push the contents of `dist/` to the `gh-pages` branch
3. GitHub Pages serves it at:

```
https://<your-username>.github.io/Sinyal-trading/
```

### Option B: Manual setup

1. Push your code to GitHub.
2. Go to **Settings → Pages**.
3. Set **Source** to "Deploy from a branch".
4. Select the `gh-pages` branch, root (`/`).
5. Save and wait for deployment.

> [!IMPORTANT]
> The Vite `base` path is set to `/Sinyal-trading/` in `vite.config.js`. If you rename the repo, update `base` to match the new repository name, then rebuild and redeploy.

---

## 🔑 How to Configure Your Twelve Data API Key

The app needs a [Twelve Data](https://twelvedata.com) API key to stream live XAU/USD prices.

### Get a free API key

1. Go to [**https://twelvedata.com**](https://twelvedata.com)
2. Sign up for a **free account**
3. Navigate to your Dashboard → API Keys
4. Copy your API key

### Enter it in the app

1. Open the app in your browser
2. Click the **⚙️ Settings** panel
3. Paste your API key into the **API Key** field
4. The key is saved to **localStorage** — it never leaves your browser

```
┌─────────────────────────────────────┐
│  ⚙️  Settings                       │
│                                     │
│  API Key: [••••••••••••••••••]  ✓   │
│                                     │
│  Saved to localStorage              │
└─────────────────────────────────────┘
```

> [!CAUTION]
> Your API key is stored **only** in your browser's localStorage. It is never sent to any server other than Twelve Data's WebSocket endpoint. Clearing browser data will remove the key — you'll need to re-enter it.

---

## 🔌 How the WebSocket Works

The app establishes a persistent WebSocket connection to Twelve Data's real-time price stream.

### Connection flow

```
Browser                           Twelve Data
  │                                    │
  │── WSS CONNECT ────────────────────▶│  wss://ws.twelvedata.com/v1/quotes/price?apikey=KEY
  │◀─────────────── CONNECTED ─────────│
  │                                    │
  │── SUBSCRIBE { "symbols": "XAU/USD" } ──▶│
  │◀─────────────── ACK ──────────────│
  │                                    │
  │◀──── TICK { price, timestamp } ────│  (continuous)
  │◀──── TICK { price, timestamp } ────│
  │◀──── TICK { price, timestamp } ────│
  │         ...                        │
```

### Key behaviors

| Behavior | Detail |
|----------|--------|
| **Endpoint** | `wss://ws.twelvedata.com/v1/quotes/price?apikey=<YOUR_KEY>` |
| **Subscription** | Sends `{ "action": "subscribe", "params": { "symbols": "XAU/USD" } }` on connect |
| **Tick events** | Each message contains `price` (float) and `timestamp` (Unix seconds) |
| **Heartbeat** | Client sends a ping every **10 seconds** to keep the connection alive |
| **Auto-reconnect** | On disconnect, reconnects with **exponential backoff** (1s → 2s → 4s → … → 30s max) |
| **Error handling** | Invalid API key or rate-limit errors are surfaced in the UI |

---

## 🕯️ How the Candle Builder Works

Raw ticks are aggregated into OHLC candles entirely on the client side.

### M1 (1-minute) candles — built from ticks

```
Tick arrives: { price: 2345.67, timestamp: 1716854523 }
                                          │
                      Floor to minute ────┘
                      boundary: 1716854500
                                │
               ┌────────────────┴────────────────┐
               │  Candle for minute 1716854500    │
               │  O: first tick price             │
               │  H: max(all tick prices)         │
               │  L: min(all tick prices)         │
               │  C: latest tick price            │
               └─────────────────────────────────┘
```

1. Each tick's timestamp is **floored to the nearest minute boundary** (e.g., `12:05:23` → `12:05:00`).
2. If no candle exists for that minute, a new one is created with `O = H = L = C = price`.
3. Subsequent ticks in the same minute update `H`, `L`, and `C`.

### Higher timeframes — aggregated from M1

| Timeframe | Built from | Aggregation window |
|-----------|------------|-------------------|
| **M5** | M1 candles | 5-minute boundary |
| **M15** | M1 candles | 15-minute boundary |
| **H1** | M1 candles | 60-minute boundary |

### Candle lifecycle

- 🟡 **Current (open) candle** — updates in real-time with each new tick
- 🟢 **Closed candle** — immutable once the time window elapses; never modified again

---

## 📐 How Swing High / Swing Low Works

The app uses a **fractal / pivot detection** algorithm to identify significant swing points.

### Algorithm

A **Swing High** at candle `i` is confirmed when:

```
candle[i].high > candle[i-1].high
candle[i].high > candle[i-2].high
  ...
candle[i].high > candle[i-N].high    (N candles to the LEFT)

AND

candle[i].high > candle[i+1].high
candle[i].high > candle[i+2].high
  ...
candle[i].high > candle[i+N].high    (N candles to the RIGHT)
```

A **Swing Low** follows the same logic using `candle.low` with `<` comparisons.

### Parameters

| Setting | Default | Description |
|---------|---------|-------------|
| **Swing Strength (N)** | `3` | Number of candles on each side required to confirm a swing |

### Confirmation & display

- ⏳ **Candidate** — A potential swing where the left condition is met but fewer than N right-side candles have passed. Shown with a **dashed / dimmed** marker.
- ✅ **Confirmed** — All N right-side candles satisfy the condition. Shown with a **solid** marker.
- 🔒 **No repainting** — Once a swing is confirmed, it is never removed or repositioned. Candidates may be discarded if they fail the right-side check.

---

## 🧹 How Sweep Detection Works

A **sweep** (also called a liquidity grab) occurs when price briefly pierces a key level but fails to hold beyond it.

### Detection logic

```
                 Sweep detected here
                       │
     Key Level ────────┼──────────────
                       │
            ┌──────┐   │
            │      │ ──┘  ◀── Wick pierces above level
            │  ██  │         Body closes BELOW level
            │  ██  │
            │      │
            └──────┘
```

1. **Price pierces the level** — the candle's wick (high or low) crosses beyond a key level
2. **Body closes back inside** — the candle's close remains on the original side of the level
3. **Key levels checked** — session highs/lows and confirmed Swing High / Swing Low levels
4. **Anti-spam** — duplicate sweep alerts on the same level within a cooldown window are suppressed

> [!NOTE]
> A sweep indicates the market grabbed liquidity beyond a level but rejected. It is the **opposite** of a breakout, where price closes beyond the level and stays.

---

## 🔀 How BOS, CHoCH, and Breakout Work

These are the core market structure signals the app detects and labels on the chart.

### Break of Structure (BOS)

A BOS confirms that the **existing trend continues**.

| Signal | Condition | Trend context |
|--------|-----------|---------------|
| 🟢 **BOS Bullish** | Candle **closes above** a confirmed Swing High | Trend was already **bullish** |
| 🔴 **BOS Bearish** | Candle **closes below** a confirmed Swing Low | Trend was already **bearish** |

```
         BOS Bullish
             │
  SH ────────┼──── price closes above
             │
   /\   /\   │  /\
  /  \ /  \ /  /  \
 /    \/    \/  /    \       ▲ Bullish trend continues
```

### Change of Character (CHoCH)

A CHoCH signals a **trend reversal**.

| Signal | Condition | Trend context |
|--------|-----------|---------------|
| 🟢 **CHoCH Bullish** | Candle **closes above** a confirmed Swing High | Trend was **bearish** → now bullish |
| 🔴 **CHoCH Bearish** | Candle **closes below** a confirmed Swing Low | Trend was **bullish** → now bearish |

```
  Bearish trend                CHoCH Bullish
       \                           │
        \    /\                    │
         \  /  \   SH ────────────┼── price closes above
          \/    \      /          │
                 \    /           ▲ Trend reversal!
                  \  /
                   \/
```

### Breakout

A **breakout** is the opposite of a sweep — price closes beyond a key level **and stays there**.

```
                 Breakout
                    │
     Key Level ─────┼──────────
                    │
            ┌──────┐
            │  ██  │ ──── Close is ABOVE the level
            │  ██  │      (body fully beyond)
            │      │
            └──────┘
```

### Summary table

| Signal | Price action | Prior trend | Result |
|--------|-------------|-------------|--------|
| BOS Bullish | Close > Swing High | Bullish | Trend continuation ↗️ |
| BOS Bearish | Close < Swing Low | Bearish | Trend continuation ↘️ |
| CHoCH Bullish | Close > Swing High | Bearish | Trend reversal ↗️ |
| CHoCH Bearish | Close < Swing Low | Bullish | Trend reversal ↘️ |
| Sweep | Wick beyond level, close inside | Any | Liquidity grab 🧹 |
| Breakout | Close beyond level, holds | Any | Level break 💥 |

---

## ⚠️ Important Note

> [!WARNING]
> **This application is a visual analysis tool ONLY.**

- ❌ **NOT** for automated entry or exit signals
- ❌ **NOT** connected to any broker (no MetaTrader, no cTrader, no OANDA, no IBKR)
- ❌ **NOT** for automated trading (no EA, no bot, no algo execution)
- ❌ **No backend** — everything runs in-browser
- ❌ **No Telegram integration**
- ❌ **No MT5 / MT4 bridge**
- ❌ **No VPS or Docker required**

This tool helps you **see** market structure. Trading decisions are **yours alone**.

> *"Past performance is not indicative of future results. Trading forex and commodities involves substantial risk of loss and is not suitable for every investor."*

---

## 📁 Project Structure

```
Sinyal-trading/
├── index.html              # Entry point with PWA manifest & service worker registration
├── package.json            # Dependencies and scripts
├── vite.config.js          # Vite config (base path, dev server)
├── public/
│   ├── manifest.json       # PWA manifest
│   ├── sw.js               # Service worker for offline support
│   └── icons/              # App icons (192px, 512px, SVG)
└── src/
    ├── main.jsx            # React entry
    ├── App.jsx             # Root component
    ├── components/         # UI components (Chart, Settings, Alerts…)
    ├── hooks/              # Custom React hooks (useWebSocket, useCandleBuilder…)
    ├── lib/                # Core logic (swings, sweeps, BOS, CHoCH, candle aggregation)
    └── styles/             # CSS modules / global styles
```

---

## 📜 Scripts Reference

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server on port 3000 |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Preview production build locally |
| `npm run deploy` | Build + push `dist/` to `gh-pages` branch |

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with ❤️ for price action traders**

React • Vite • TradingView Lightweight Charts • Twelve Data • PWA

</div>
]]>
