import React, { useEffect, useRef } from 'react';
import { createChart, CrosshairMode } from 'lightweight-charts';

export default function ChartView({
  candles,
  sessionLevels,
  swings,
  sweepEvents,
  msEvents,
  breakoutEvents,
  tradeSignals
}) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const linesRef = useRef([]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: 'solid', color: 'transparent' },
        textColor: '#e8e8f0',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
      autoSize: true, // Use built-in autoSize if supported by v4
    });

    chartRef.current = chart;

    // Create candlestick series
    const series = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });

    seriesRef.current = series;

    const handleResize = () => {
      chart.applyOptions({
        width: chartContainerRef.current.clientWidth,
        height: chartContainerRef.current.clientHeight,
      });
    };
    
    // Fallback resize observer
    const resizeObserver = new ResizeObserver(entries => {
      if (entries.length === 0 || entries[0].target !== chartContainerRef.current) return;
      handleResize();
    });
    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, []);

  // Update Data
  useEffect(() => {
    if (!seriesRef.current || !candles || candles.length === 0) return;
    
    // Deduplicate and filter candles just in case
    const validCandles = candles.filter(c => c && c.time && typeof c.time === 'number');
    
    // Sort by time
    validCandles.sort((a, b) => a.time - b.time);
    
    // Remove duplicates based on time
    const uniqueCandles = [];
    let lastTime = 0;
    for (const c of validCandles) {
      if (c.time > lastTime) {
        uniqueCandles.push(c);
        lastTime = c.time;
      } else if (c.time === lastTime) {
        // Update the last candle
        uniqueCandles[uniqueCandles.length - 1] = c;
      }
    }

    if (uniqueCandles.length > 0) {
      try {
        seriesRef.current.setData(uniqueCandles);
      } catch (err) {
        console.warn('Failed to setData:', err);
      }
    }
  }, [candles]);

  // Price Lines (Session Levels, Swings, Trade Signals)
  useEffect(() => {
    if (!seriesRef.current) return;
    
    // Remove old lines
    linesRef.current.forEach(line => {
      try {
        seriesRef.current.removePriceLine(line);
      } catch(e) {}
    });
    linesRef.current = [];

    // Add Session Levels
    const activeLevels = [
      { name: 'Asia H', price: sessionLevels.asiaHigh, color: 'rgba(255, 215, 0, 0.5)' },
      { name: 'Asia L', price: sessionLevels.asiaLow, color: 'rgba(255, 215, 0, 0.5)' },
      { name: 'Lon H', price: sessionLevels.londonHigh, color: 'rgba(59, 130, 246, 0.5)' },
      { name: 'Lon L', price: sessionLevels.londonLow, color: 'rgba(59, 130, 246, 0.5)' },
      { name: 'NY H', price: sessionLevels.nyHigh, color: 'rgba(38, 166, 154, 0.5)' },
      { name: 'NY L', price: sessionLevels.nyLow, color: 'rgba(38, 166, 154, 0.5)' },
      { name: 'PDH', price: sessionLevels.prevDayHigh, color: 'rgba(239, 83, 80, 0.5)' },
      { name: 'PDL', price: sessionLevels.prevDayLow, color: 'rgba(239, 83, 80, 0.5)' },
    ].filter(l => Number.isFinite(l.price));

    activeLevels.forEach(level => {
      const line = seriesRef.current.createPriceLine({
        price: level.price,
        color: level.color,
        lineWidth: 1,
        lineStyle: 2, // Dashed
        axisLabelVisible: true,
        title: level.name,
      });
      linesRef.current.push(line);
    });

    // Add Swings
    const allSwings = [...(swings.confirmed || []), ...(swings.candidates || [])];
    // Keep only last N to prevent clutter
    const recentSwings = allSwings.sort((a,b) => b.time - a.time).slice(0, 15);
    
    recentSwings.forEach(swing => {
      if (!Number.isFinite(swing.price)) return;

      const isConfirmed = swing.status === 'confirmed';
      const color = swing.type === 'high' ? 
        (isConfirmed ? '#26a69a' : 'rgba(38, 166, 154, 0.4)') : 
        (isConfirmed ? '#ef5350' : 'rgba(239, 83, 80, 0.4)');
      
      const line = seriesRef.current.createPriceLine({
        price: swing.price,
        color: color,
        lineWidth: isConfirmed ? 2 : 1,
        lineStyle: isConfirmed ? 0 : 2, // Solid vs Dashed
        axisLabelVisible: false,
        title: '',
      });
      linesRef.current.push(line);
    });

    const activeSignals = [...(tradeSignals || [])]
      .filter(signal => signal.status === 'waiting_limit' || signal.status === 'limit_hit')
      .sort((a, b) => b.createdTime - a.createdTime)
      .slice(0, 3);

    activeSignals.forEach(signal => {
      const signalColor = signal.side === 'sell' ? '#ef5350' : '#26a69a';
      addSignalLine(signal.entryLow, signalColor, `${signal.type} Low`, 2);
      addSignalLine(signal.entryHigh, signalColor, `${signal.type} High`, 2);
      addSignalLine(signal.sl, '#f97316', 'SL', 1);
      addSignalLine(signal.tp1, '#22d3ee', 'TP1', 1);
      addSignalLine(signal.tp2, '#22d3ee', 'TP2', 1);
    });

    function addSignalLine(price, color, title, width) {
      if (!Number.isFinite(price)) return;
      const line = seriesRef.current.createPriceLine({
        price,
        color,
        lineWidth: width,
        lineStyle: 1,
        axisLabelVisible: true,
        title,
      });
      linesRef.current.push(line);
    }
  }, [sessionLevels, swings, tradeSignals]);

  // Markers (Sweeps, BOS/CHoCH, Breakouts, Trade Signals)
  useEffect(() => {
    if (!seriesRef.current) return;

    const markers = [];

    // Format events into markers
    [...(msEvents || [])].forEach(ev => {
      markers.push({
        time: ev.time,
        position: ev.direction === 'bullish' ? 'belowBar' : 'aboveBar',
        color: ev.type === 'bos' ? '#3b82f6' : '#a855f7',
        shape: ev.direction === 'bullish' ? 'arrowUp' : 'arrowDown',
        text: ev.type.toUpperCase(),
      });
    });

    [...(breakoutEvents || [])].forEach(ev => {
      const isBullish = ev.direction === 'bullish' || ev.type === 'breakout_bullish' || ev.type === 'valid_break_bullish' || ev.type === 'fake_break_bullish';
      const isValid = ev.type?.startsWith('valid_break');
      const isFake = ev.type?.startsWith('fake_break');
      markers.push({
        time: ev.time,
        position: isBullish ? 'belowBar' : 'aboveBar',
        color: isValid ? '#22c55e' : isFake ? '#f97316' : '#22d3ee',
        shape: isBullish ? 'arrowUp' : 'arrowDown',
        text: isValid ? 'VALID' : isFake ? 'FAKE' : 'BRK',
      });
    });

    [...(sweepEvents || [])].forEach(ev => {
      markers.push({
        time: ev.time,
        position: ev.type === 'high_sweep' ? 'aboveBar' : 'belowBar',
        color: '#f59e0b',
        shape: 'circle',
        text: 'SW',
      });
    });

    [...(tradeSignals || [])].forEach(signal => {
      markers.push({
        time: signal.createdTime,
        position: signal.side === 'buy' ? 'belowBar' : 'aboveBar',
        color: signal.side === 'buy' ? '#26a69a' : '#ef5350',
        shape: signal.side === 'buy' ? 'arrowUp' : 'arrowDown',
        text: signal.side === 'buy' ? 'BUY LIMIT' : 'SELL LIMIT',
      });
    });

    // Sort markers by time
    markers.sort((a, b) => a.time - b.time);

    try {
      seriesRef.current.setMarkers(markers);
    } catch (e) {
      console.warn('Failed to set markers:', e);
    }
  }, [sweepEvents, msEvents, breakoutEvents, tradeSignals]);

  return (
    <div ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />
  );
}
