import React from 'react';
import { WS_STATUS } from '../services/twelveDataSocket';

export default function ConnectionStatus({ status, error }) {
  const getStatusClass = () => {
    switch (status) {
      case WS_STATUS.CONNECTED: return 'connected';
      case WS_STATUS.CONNECTING:
      case WS_STATUS.RECONNECTING: return 'connecting';
      case WS_STATUS.DISCONNECTED:
      case WS_STATUS.ERROR:
      default: return 'error';
    }
  };

  return (
    <div className="connection-status">
      <div className={`status-dot ${getStatusClass()}`}></div>
      <span>{status}</span>
      {error && <span style={{ color: 'var(--bear-color)', fontSize: '0.8rem', marginLeft: '8px' }}>({error})</span>}
    </div>
  );
}
