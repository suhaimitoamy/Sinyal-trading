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

import ChartView from './components/ChartView';
import TimeframeSelector from './components/TimeframeSelector';
import ConnectionStatus from './components/ConnectionStatus';
import PricePanel from './components/PricePanel';
import SessionLevelPanel from './components/SessionLevelPanel';
import SwingPanel from './components/SwingPanel';
import SweepPanel from './components/SweepPanel';
import MarketStructurePanel from './components/MarketStructurePanel';
import Settings from './components/Settings';

export default function App() {
  const [apiKey, setApiKey] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState(null);

  const [activeTimeframe, setActiveTimeframe] = useState('m1');
  const [connectionStatus, setConnectionStatus] = useState(WS_STATUS.DISCONNECTED);
  const [error, setError] = useState(null);
  const [currentPrice, setCurrentPrice] = useState(null);
  
  // Chart Data State
  const [candles, setCandles] = useState([]);
  const [sessionLevels, setSessionLevels] = useState({});
  const [sessionStatus, setSessionStatus] = useState({});
  const [swings, setSwings] = useState({ confirmed: [], candidates: [] });
  const [sweeps, setSweeps] = useState([]);
  const [msEvents, setMsEvents] = useState([]);
  const [breakouts, setBreakouts] = useState([]);
  const [trend, setTrend] = useState('undefined');

  // Services Refs
  const socketRef = useRef(null);
  const cbRef = useRef(null);
  const tfRef = useRef(null);
  const slRef = useRef(null);
  const swRef = useRef(null);
  const sweepRef = useRef(null);
  const msRef = useRef(null);
  const brkRef = useRef(null);

  // Initialize Services
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

    socketRef.current = new TwelveDataSocket();

    // Data Pipeline Logic
    // 1. Tick -> M1 Candle
    socketRef.current.onTick(tick => {
      setCurrentPrice(tick.price);
      cbRef.current.processTick(tick);
    });

    socketRef.current.onStatusChange((status) => {
      setConnectionStatus(status);
      if (status === WS_STATUS.CONNECTED) setError(null);
    });

    socketRef.current.onError((err) => {
      setError(err);
    });

    // 2. M1 Update -> UI (if M1 active) -> TF Aggregator
    cbRef.current.onCandleUpdate(m1Candle => {
      if (activeTimeframe === 'm1') {
        setCandles(cbRef.current.getAllCandles());
      }
      tfRef.current.processM1Candle(m1Candle, false);
    });

    // 3. M1 Close -> SessionTracker -> Swing -> Detectors -> TF Aggregator
    cbRef.current.onCandleClose(closedM1 => {
      slRef.current.processCandle(closedM1);
      setSessionLevels(slRef.current.getLevels());
      setSessionStatus(slRef.current.getSessionStatus());

      tfRef.current.processM1Candle(closedM1, true);

      // We run detectors on M1 if M1 is active TF, or always? 
      // Market structure is usually analyzed on the active TF.
      // Let's analyze on the active TF.
      if (activeTimeframe === 'm1') {
        analyzeTimeframe(cbRef.current.getCandles(), closedM1);
      }
    });

    // 4. TF Update
    ['m5', 'm15', 'h1'].forEach(tf => {
      tfRef.current.onCandleUpdate(tf, (candle) => {
        if (activeTimeframe === tf) {
          setCandles(tfRef.current.getCandles(tf));
        }
      });
      tfRef.current.onCandleClose(tf, (closedCandle) => {
        if (activeTimeframe === tf) {
          const c = tfRef.current.getCandles(tf);
          analyzeTimeframe(c.filter(candle => candle.time !== c[c.length - 1]?.time), closedCandle);
        }
      });
    });

    return () => {
      if (socketRef.current) socketRef.current.destroy();
    };
  }, []);

  // Analyze structure on candle close for active TF
  const analyzeTimeframe = useCallback((completedCandles, lastClosedCandle) => {
    // 1. Detect Swings
    const swingData = swRef.current.processCandles(completedCandles);
    setSwings(swingData);

    const levels = slRef.current.getLevels();
    const confirmedSwings = swingData?.confirmed || [];

    // 2. Detect Sweeps
    const newSweeps = sweepRef.current.detect(lastClosedCandle, levels, confirmedSwings);
    if (newSweeps.length > 0) setSweeps(sweepRef.current.getHistory());

    // 3. Detect BOS/CHoCH
    const newMs = msRef.current.detect(lastClosedCandle, confirmedSwings);
    if (newMs.length > 0) {
      setMsEvents(msRef.current.getHistory());
      setTrend(msRef.current.getTrend());
    }

    // 4. Detect Breakouts
    const newBrk = brkRef.current.detect(lastClosedCandle, levels, confirmedSwings);
    if (newBrk.length > 0) setBreakouts(brkRef.current.getHistory());
  }, []);

  // Connect WebSocket when API Key is set
  useEffect(() => {
    if (apiKey && socketRef.current && socketRef.current.getStatus() === WS_STATUS.DISCONNECTED) {
      socketRef.current.connect(apiKey, 'XAU/USD');
    }
  }, [apiKey]);

  // Handle Timeframe Change
  useEffect(() => {
    if (!cbRef.current || !tfRef.current) return;
    
    let activeCandles = [];
    if (activeTimeframe === 'm1') {
      activeCandles = cbRef.current.getAllCandles();
    } else {
      activeCandles = tfRef.current.getCandles(activeTimeframe);
    }
    
    setCandles(activeCandles);
    
    // Re-run swing detector on all completed candles of this TF
    const completed = activeTimeframe === 'm1' ? cbRef.current.getCandles() : 
      activeCandles.filter(c => c.time !== activeCandles[activeCandles.length - 1]?.time);
      
    if (completed.length > 0) {
      const swingData = swRef.current.processCandles(completed);
      setSwings(swingData);
    } else {
      setSwings({ confirmed: [], candidates: [] });
    }
  }, [activeTimeframe]);

  const handleSettingsSave = (newSettings) => {
    setSettings(newSettings);
    const key = getApiKey();
    setApiKey(key);
    setShowSettings(false);
    
    if (swRef.current) swRef.current.setStrength(newSettings.swingStrength);
    
    if (key && socketRef.current) {
      if (socketRef.current.getStatus() !== WS_STATUS.CONNECTED) {
        socketRef.current.connect(key, 'XAU/USD');
      }
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
          
          <div className="chart-container">
            <ChartView
              candles={candles}
              sessionLevels={sessionLevels}
              swings={swings}
              sweepEvents={sweeps}
              msEvents={msEvents}
              breakoutEvents={breakouts}
            />
          </div>

          <div className="panels">
            <SessionLevelPanel levels={sessionLevels} sessionStatus={sessionStatus} />
            <SwingPanel swings={swings} />
            <SweepPanel sweeps={sweeps} />
            <MarketStructurePanel trend={trend} events={[...msEvents, ...breakouts]} />
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
