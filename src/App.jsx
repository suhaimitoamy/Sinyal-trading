import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getSettings, getApiKey, saveSettings, loadCandles, saveCandles } from './services/storage';
import { TwelveDataSocket, WS_STATUS } from './services/twelveDataSocket';
import { CandleBuilder } from './services/candleBuilder';
import { TimeframeAggregator } from './services/timeframeAggregator';
import { SessionLevelTracker } from './services/sessionLevels';
import { SwingDetector } from './services/swingDetector';
import { SweepDetector } from './services/sweepDetector';
import { MarketStructureDetector } from './services/marketStructure';
import { BreakoutDetector } from './services/breakoutDetector';
import { TradeSignalEngine } from './services/tradeSignalEngine';
import { sendTelegramMessage, formatTradeSignalMessage, formatLimitHitMessage } from './services/telegram';

import ChartView from './components/ChartView';
import TimeframeSelector from './components/TimeframeSelector';
import ConnectionStatus from './components/ConnectionStatus';
import PricePanel from './components/PricePanel';
import SessionLevelPanel from './components/SessionLevelPanel';
import SwingPanel from './components/SwingPanel';
import SweepPanel from './components/SweepPanel';
import MarketStructurePanel from './components/MarketStructurePanel';
import SignalPanel from './components/SignalPanel';
import Settings from './components/Settings';

export default function App() {
  const [apiKey, setApiKey] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState(null);

  const [activeTimeframe, setActiveTimeframe] = useState('m1');
  const [connectionStatus, setConnectionStatus] = useState(WS_STATUS.DISCONNECTED);
  const [error, setError] = useState(null);
  const [currentPrice, setCurrentPrice] = useState(null);
  const [candles, setCandles] = useState([]);
  const [sessionLevels, setSessionLevels] = useState({});
  const [sessionStatus, setSessionStatus] = useState({});
  const [swings, setSwings] = useState({ confirmed: [], candidates: [] });
  const [sweeps, setSweeps] = useState([]);
  const [msEvents, setMsEvents] = useState([]);
  const [breakouts, setBreakouts] = useState([]);
  const [tradeSignals, setTradeSignals] = useState([]);
  const [trend, setTrend] = useState('undefined');
  const [activeTab, setActiveTab] = useState('signals');
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  const socketRef = useRef(null);
  const cbRef = useRef(null);
  const tfRef = useRef(null);
  const slRef = useRef(null);
  const swRef = useRef(null);
  const sweepRef = useRef(null);
  const msRef = useRef(null);
  const brkRef = useRef(null);
  const signalRef = useRef(null);
  const activeTimeframeRef = useRef('m1');
  const telegramSentRef = useRef(new Set());

  useEffect(() => {
    activeTimeframeRef.current = activeTimeframe;
  }, [activeTimeframe]);

  const notifyTelegram = useCallback((key, message) => {
    // Disable telegram notifications until historical data is fully loaded
    if (!isDataLoaded || !key || !message || telegramSentRef.current.has(key)) return;

    telegramSentRef.current.add(key);
    sendTelegramMessage(message).then(result => {
      if (!result.ok) {
        console.warn('[telegram] Notify failed:', result.reason);
      }
    }).catch(err => {
      console.warn('[telegram] Notify error:', err);
    });
  }, []);

  const handlePriceTouch = useCallback((price, timestamp) => {
    if (!signalRef.current) return;

    const hits = signalRef.current.checkLimitHits(price, timestamp);
    if (hits.length === 0) return;

    setTradeSignals(signalRef.current.getHistory());

    hits.forEach(hit => {
      notifyTelegram(
        `limit_hit_${hit.signal.id}`,
        formatLimitHitMessage(hit)
      );
    });
  }, [notifyTelegram]);

  const analyzeTimeframe = useCallback((completedCandles, lastClosedCandle) => {
    if (!swRef.current || !sweepRef.current || !msRef.current || !brkRef.current) return;

    const analysisCandles = mergeCandles(completedCandles, lastClosedCandle);
    if (analysisCandles.length === 0) return;

    const swingData = swRef.current.processCandles(analysisCandles);
    setSwings(swingData);

    const levels = slRef.current.getLevels();
    const confirmedSwings = swingData?.confirmed || [];

    const newSweeps = sweepRef.current.detect(lastClosedCandle, levels, confirmedSwings);
    if (newSweeps.length > 0) setSweeps(sweepRef.current.getHistory());

    const newMs = msRef.current.detect(lastClosedCandle, confirmedSwings);
    if (newMs.length > 0) {
      setMsEvents(msRef.current.getHistory());
      setTrend(msRef.current.getTrend());
    }

    const newBrk = brkRef.current.detect(lastClosedCandle, levels, confirmedSwings, analysisCandles);
    if (newBrk.length > 0) setBreakouts(brkRef.current.getHistory());

    if (signalRef.current) {
      const newSignals = signalRef.current.detect({
        candle: lastClosedCandle,
        candles: analysisCandles,
        levels,
        confirmedSwings,
        sweeps: sweepRef.current.getHistory(),
        msEvents: msRef.current.getHistory(),
        breakouts: brkRef.current.getHistory(),
        timeframe: activeTimeframeRef.current,
      });

      if (newSignals.length > 0) {
        setTradeSignals(signalRef.current.getHistory());

        newSignals.forEach(signal => {
          notifyTelegram(
            `signal_${signal.id}`,
            formatTradeSignalMessage(signal)
          );
        });
      }
    }
  }, [notifyTelegram]);

  useEffect(() => {
    const key = getApiKey();
    setApiKey(key);
    const sets = getSettings();
    setSettings(sets);
    if (!key) setShowSettings(true);

    cbRef.current = new CandleBuilder();
    tfRef.current = new TimeframeAggregator();
    slRef.current = new SessionLevelTracker();
    swRef.current = new SwingDetector(sets.swingStrength);
    sweepRef.current = new SweepDetector();
    msRef.current = new MarketStructureDetector();
    brkRef.current = new BreakoutDetector();
    signalRef.current = new TradeSignalEngine();
    socketRef.current = new TwelveDataSocket();

    socketRef.current.onTick(tick => {
      setCurrentPrice(tick.price);
      handlePriceTouch(tick.price, tick.timestamp);
      cbRef.current.processTick(tick);
    });

    socketRef.current.onStatusChange((status) => {
      setConnectionStatus(status);
      if (status === WS_STATUS.CONNECTED) setError(null);
    });

    socketRef.current.onError((err) => setError(err));

    // Async init function to load persisted data
    const initData = async () => {
      try {
        const [m1, m5, m15, h1] = await Promise.all([
          loadCandles('m1'),
          loadCandles('m5'),
          loadCandles('m15'),
          loadCandles('h1')
        ]);
        
        if (m1.length > 0) {
          cbRef.current.setCandles(m1);
          tfRef.current.setCandles('m5', m5);
          tfRef.current.setCandles('m15', m15);
          tfRef.current.setCandles('h1', h1);

          // Rebuild analysis from loaded M1 candles
          m1.forEach(c => slRef.current.processCandle(c));
          setSessionLevels(slRef.current.getLevels());
          setSessionStatus(slRef.current.getSessionStatus());
          
          if (activeTimeframeRef.current === 'm1') {
             const activeC = m1;
             for (let i = 1; i <= activeC.length; i++) {
               const sliced = activeC.slice(0, i);
               analyzeTimeframe(sliced, activeC[i - 1]);
             }
          } else {
             const activeC = tfRef.current.getCandles(activeTimeframeRef.current);
             for (let i = 1; i <= activeC.length; i++) {
               const sliced = activeC.slice(0, i);
               analyzeTimeframe(sliced, activeC[i - 1]);
             }
          }
        }
      } catch (err) {
        console.error('[App] Failed to load persisted candles:', err);
      } finally {
        setIsDataLoaded(true);
      }
    };
    initData();

    cbRef.current.onCandleUpdate(m1Candle => {
      if (activeTimeframeRef.current === 'm1') setCandles(cbRef.current.getAllCandles());
      tfRef.current.processM1Candle(m1Candle, false);
    });

    cbRef.current.onCandleClose(closedM1 => {
      const sets = getSettings();
      cbRef.current.trimCandles(sets.maxCandles || 5000);
      slRef.current.processCandle(closedM1);
      setSessionLevels(slRef.current.getLevels());
      setSessionStatus(slRef.current.getSessionStatus());
      tfRef.current.processM1Candle(closedM1, true);
      
      const allM1 = cbRef.current.getCandles();
      saveCandles('m1', allM1).catch(e => console.warn('[App] M1 save failed:', e));
      
      if (activeTimeframeRef.current === 'm1') analyzeTimeframe(allM1, closedM1);
    });

    ['m5', 'm15', 'h1'].forEach(tf => {
      tfRef.current.onCandleUpdate(tf, () => {
        if (activeTimeframeRef.current === tf) setCandles(tfRef.current.getCandles(tf));
      });
      tfRef.current.onCandleClose(tf, (closedCandle) => {
        const tfCandles = tfRef.current.getCandles(tf);
        saveCandles(tf, tfCandles).catch(e => console.warn(`[App] ${tf} save failed:`, e));
        if (activeTimeframeRef.current === tf) analyzeTimeframe(tfCandles, closedCandle);
      });
    });

    // Periodic save for currently forming M1 candle so we don't lose the last minute of data on refresh
    const periodicSaveInterval = setInterval(() => {
      if (!cbRef.current) return;
      const allM1 = cbRef.current.getAllCandles();
      if (allM1.length > 0) {
        saveCandles('m1', allM1).catch(e => console.warn('[App] Periodic M1 save failed:', e));
      }
    }, 15000);

    return () => {
      clearInterval(periodicSaveInterval);
      if (socketRef.current) socketRef.current.destroy();
    };
  }, [analyzeTimeframe, handlePriceTouch]);

  useEffect(() => {
    if (apiKey && socketRef.current && socketRef.current.getStatus() === WS_STATUS.DISCONNECTED) {
      socketRef.current.connect(apiKey, 'XAU/USD');
    }
  }, [apiKey]);

  useEffect(() => {
    const handleOnline = () => {
      if (apiKey && socketRef.current) {
        // If we are currently disconnected or hit an error, attempt to reconnect
        const status = socketRef.current.getStatus();
        if (status === WS_STATUS.DISCONNECTED || status === WS_STATUS.ERROR) {
          console.log('[App] Network online. Attempting to reconnect WebSocket...');
          socketRef.current.reconnectAttempts = 0; // reset attempts for immediate reconnect
          socketRef.current.reconnect();
        }
      }
    };

    const handleOffline = () => {
      console.log('[App] Network offline. WebSocket will likely disconnect.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [apiKey]);

  useEffect(() => {
    if (!cbRef.current || !tfRef.current) return;

    const activeCandles = activeTimeframe === 'm1' ? cbRef.current.getAllCandles() : tfRef.current.getCandles(activeTimeframe);
    setCandles(activeCandles);

    const completed = activeTimeframe === 'm1'
      ? cbRef.current.getCandles()
      : activeCandles.filter(c => c.time !== activeCandles[activeCandles.length - 1]?.time);

    if (completed.length > 0) setSwings(swRef.current.processCandles(completed));
    else setSwings({ confirmed: [], candidates: [] });
  }, [activeTimeframe]);

  const handleSettingsSave = (newSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);

    const key = getApiKey();
    setApiKey(key);
    setShowSettings(false);

    if (swRef.current) swRef.current.setStrength(newSettings.swingStrength);
    if (key && socketRef.current && socketRef.current.getStatus() !== WS_STATUS.CONNECTED) {
      socketRef.current.connect(key, 'XAU/USD');
    }
  };

  return (
    <div className="app">
      <header>
        <div className="logo">XAU/USD Market Structure</div>
        <PricePanel price={currentPrice} />
        <ConnectionStatus status={connectionStatus} error={error} />
        <button className="settings-btn" onClick={() => setShowSettings(!showSettings)}>
          {showSettings ? '✕' : '⚙️'}
        </button>
      </header>

      {showSettings ? (
        <Settings onSave={handleSettingsSave} />
      ) : (
        <>
          <TimeframeSelector active={activeTimeframe} onChange={setActiveTimeframe} />

          {!isDataLoaded ? (
             <div className="chart-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
               <h3 style={{ color: 'var(--text-secondary)' }}>Loading historical data...</h3>
             </div>
          ) : (
            <div className="chart-container">
              <ChartView
                candles={candles}
                sessionLevels={sessionLevels}
                swings={swings}
                sweepEvents={sweeps}
                msEvents={msEvents}
                breakoutEvents={breakouts}
                tradeSignals={tradeSignals}
              />
            </div>
          )}

          <div className="panels-container">
            <div className="panel-tabs">
              <button className={`tab-btn ${activeTab === 'signals' ? 'active' : ''}`} onClick={() => setActiveTab('signals')}>Signals</button>
              <button className={`tab-btn ${activeTab === 'ms' ? 'active' : ''}`} onClick={() => setActiveTab('ms')}>Market Structure</button>
              <button className={`tab-btn ${activeTab === 'sweeps' ? 'active' : ''}`} onClick={() => setActiveTab('sweeps')}>Sweeps</button>
              <button className={`tab-btn ${activeTab === 'swings' ? 'active' : ''}`} onClick={() => setActiveTab('swings')}>Swings</button>
              <button className={`tab-btn ${activeTab === 'sessions' ? 'active' : ''}`} onClick={() => setActiveTab('sessions')}>Sessions</button>
            </div>
            <div className="panel-content-area">
              {activeTab === 'signals' && <SignalPanel signals={tradeSignals} />}
              {activeTab === 'ms' && <MarketStructurePanel trend={trend} events={[...msEvents, ...breakouts]} />}
              {activeTab === 'sweeps' && <SweepPanel sweeps={sweeps} />}
              {activeTab === 'swings' && <SwingPanel swings={swings} />}
              {activeTab === 'sessions' && <SessionLevelPanel levels={sessionLevels} sessionStatus={sessionStatus} />}
            </div>
          </div>
        </>
      )}

      {!apiKey && !showSettings && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--bg-primary)', zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <h2 style={{ marginBottom: '20px', color: 'var(--accent-gold)' }}>Welcome to XAU/USD Market Structure Chart</h2>
          <p style={{ marginBottom: '30px', color: 'var(--text-secondary)' }}>Please enter your Twelve Data API Key in Settings to start.</p>
          <button className="btn-primary" style={{ width: 'auto' }} onClick={() => setShowSettings(true)}>Open Settings</button>
        </div>
      )}
    </div>
  );
}

function mergeCandles(completedCandles, lastClosedCandle) {
  const map = new Map();

  for (const candle of completedCandles || []) {
    if (candle && Number.isFinite(candle.time)) map.set(candle.time, candle);
  }

  if (lastClosedCandle && Number.isFinite(lastClosedCandle.time)) {
    map.set(lastClosedCandle.time, lastClosedCandle);
  }

  return [...map.values()].sort((a, b) => a.time - b.time);
}
