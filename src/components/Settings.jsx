import React, { useState, useEffect } from 'react';
import {
  getSettings,
  saveSettings,
  getApiKey,
  saveApiKey,
  getTelegramSettings,
  saveTelegramSettings,
  clearAllData,
} from '../services/storage';

export default function Settings({ onSave }) {
  const [apiKey, setApiKey] = useState('');
  const [telegramConfig, setTelegramConfig] = useState({
    botToken: '',
    chatId: '',
  });
  const [settings, setSettings] = useState({
    symbol: 'XAU/USD',
    displayTimezone: 'local',
    swingStrength: 3,
    maxCandles: 5000,
  });

  useEffect(() => {
    setApiKey(getApiKey() || '');
    setTelegramConfig(getTelegramSettings());
    setSettings(getSettings());
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: name === 'swingStrength' || name === 'maxCandles' ? Number(value) : value,
    }));
  };

  const handleTelegramChange = (e) => {
    const { name, value } = e.target;
    setTelegramConfig(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    saveApiKey(apiKey);
    saveTelegramSettings(telegramConfig);
    saveSettings(settings);
    if (onSave) onSave(settings);
  };

  const handleClear = async () => {
    if (window.confirm("Are you sure you want to clear all locally stored candle and signal data? This cannot be undone.")) {
      await clearAllData();
      alert("Data cleared successfully. The app will reload.");
      window.location.reload();
    }
  };

  return (
    <div className="settings-view">
      <div className="settings-card">
        <h2 style={{ marginBottom: '20px', color: 'var(--accent-gold)' }}>Settings</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Twelve Data API Key</label>
            <input 
              type="password" 
              className="form-control" 
              value={apiKey} 
              onChange={e => setApiKey(e.target.value)} 
              placeholder="Paste your API key here" 
              required
            />
          </div>

          <div className="form-group">
            <label>Symbol</label>
            <input 
              type="text" 
              className="form-control" 
              name="symbol"
              value={settings.symbol}
              onChange={handleChange}
              disabled
            />
            <small style={{ color: 'var(--text-muted)' }}>Only XAU/USD is supported currently.</small>
          </div>

          <div className="form-group">
            <label>Swing Detection Strength (N candles)</label>
            <input 
              type="number" 
              className="form-control" 
              name="swingStrength"
              min="1" max="10"
              value={settings.swingStrength}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>Max Candle Storage</label>
            <input 
              type="number" 
              className="form-control" 
              name="maxCandles"
              min="100" max="50000"
              value={settings.maxCandles}
              onChange={handleChange}
            />
          </div>


          <div style={{ margin: '30px 0 20px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
            <h3 style={{ color: 'var(--accent-gold)', marginBottom: '15px' }}>Telegram Alert</h3>

            <div className="form-group">
              <label>Telegram Bot Token</label>
              <input 
                type="password" 
                className="form-control" 
                name="botToken"
                value={telegramConfig.botToken}
                onChange={handleTelegramChange}
                placeholder="Paste your Telegram bot token here" 
              />
            </div>

            <div className="form-group">
              <label>Telegram Chat ID</label>
              <input 
                type="text" 
                className="form-control" 
                name="chatId"
                value={telegramConfig.chatId}
                onChange={handleTelegramChange}
                placeholder="Paste your Telegram chat ID here" 
              />
            </div>

            <small style={{ color: 'var(--text-muted)' }}>
              Telegram settings are stored locally in this browser.
            </small>
          </div>

          <button type="submit" className="btn-primary">Save Settings</button>
        </form>

        <div style={{ marginTop: '40px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
          <h3 style={{ color: 'var(--bear-color)', marginBottom: '10px' }}>Danger Zone</h3>
          <button 
            type="button" 
            onClick={handleClear} 
            style={{ background: 'var(--bear-color)', color: 'white', border: 'none', padding: '10px 20px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Clear All Stored Data
          </button>
        </div>
      </div>
    </div>
  );
}
