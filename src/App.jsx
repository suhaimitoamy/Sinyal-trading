import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getSettings, getApiKey, saveSettings } from './services/storage';
import { TwelveDataSocket, WS_STATUS } from './services/twelveDataSocket';
import { CandleBuilder } from './services/candleBuilder';
import { TimeframeAggregator } from './services/timeframeAggregator';
import { SessionLevelTracker } from './services/sessionLevels';
import { SwingDetector } from './services/swingDetector';
import { SweepDetector } from './services/sweepDetector';
import { MarketStructureDetector } from './services/marketStructure';
import { BreakoutDetector } from './services/breakoutDetector';
import { TradeSignalEngine } from './services/tradeSignalEngine';

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

  useEffect(() => {
    activeTimeframeRef.current = activeTimeframe;
  }, [activeTimeframe]);

  const handlePriceTouch = useCallback((price, timestamp) => {
    if (!signalRef.current) return;
    const hits = signalRef.current.checkLimitHits(price, timestamp);
    if (hits.length > 0) setTradeSignals(signalRef.current.getHistory());
  }, []);

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

      if (newSignals.length > 0) setTradeSignals(signalRef.current.getHistory());
    }
  }, []);

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

    cbRef.current.onCandleUpdate(m1Candle => {
      if (activeTimeframeRef.current === 'm1') setCandles(cbRef.current.getAllCandles());
      tfRef.current.processM1Candle(m1Candle, false);
    });

    cbRef.current.onCandleClose(closedM1 => {
      slRef.current.processCandle(closedM1);
      setSessionLevels(slRef.current.getLevels());
      setSessionStatus(slRef.current.getSessionStatus());
      tfRef.current.processM1Candle(closedM1, true);
      if (activeTimeframeRef.current === 'm1') analyzeTimeframe(cbRef.current.getCandles(), closedM1);
    });

    ['m5', 'm15', 'h1'].forEach(tf => {
      tfRef.current.onCandleUpdate(tf, () => {
        if (activeTimeframeRef.current === tf) setCandles(tfRef.current.getCandles(tf));
      });
      tfRef.current.onCandleClose(tf, (closedCandle) => {
        if (activeTimeframeRef.current === tf) analyzeTimeframe(tfRef.current.getCandles(tf), closedCandle);
      });
    });

    return () => {
      if (socketRef.current) socketRef.current.destroy();
    };
  }, [analyzeTimeframe, handlePriceTouch]);

  useEffect(() => {
    if (apiKey && socketRef.current && socketRef.current.getStatus() === WS_STATUS.DISCONNECTED) {
      socketRef.current.connect(apiKey, 'XAU/USD');
    }
  }, [apiKey]);

  useEffect(() => {
    if (!cbRef.current || !tfRef.current) return;
    const activeCandles = activeTimeframe === 'm1' ? cbRef.current.getAllCandles() : tfRef.current.getCandles(activeTimeframe);
    setCandles(activeCandles);
    const completed = activeTimeframe === 'm1' ? cbRef.current.getCandles() : activeCandles.filter(c => c.time !== activeCandles[activeCandles.length - 1]?.time);
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
    if (key && socketRef.current && socketRef.current.getStatus() !== WS_STATUS.CONNECTED) socketRef.current.connect(key, 'XAU/USD');
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
          <div className="panels">
            <SessionLevelPanel levels={sessionLevels} sessionStatus={sessionStatus} />
            <SwingPanel swings={swings} />
            <SweepPanel sweeps={sweeps} />
            <MarketStructurePanel trend={trend} events={[...msEvents, ...breakouts]} />
            <SignalPanel signals={tradeSignals} />
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
  if (lastClosedCandle && Number.isFinite(lastClosedCandle.time)) map.set(lastClosedCandle.time, lastClosedCandle);
  return [...map.values()].sort((a, b) => a.time - b.time);
}
