import React from 'react';

export default function SignalPanel({ signals }) {
  const sorted = [...(signals || [])].sort((a, b) => b.createdTime - a.createdTime).slice(0, 10);
  const formatTime = (ts) => new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const formatZone = (signal) => `${signal.entryLow.toFixed(2)}-${signal.entryHigh.toFixed(2)}`;

  return (
    <div className="panel signal-panel">
      <h3>Trade Signals</h3>
      <div className="panel-content">
        {sorted.length === 0 ? (
          <div style={{ color: 'var(--text-muted)' }}>Waiting for valid setup...</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Entry</th>
                <th>SL</th>
                <th>TP1</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(signal => (
                <tr key={signal.id}>
                  <td>
                    <span className={`badge ${signal.side === 'sell' ? 'signal-sell' : 'signal-buy'}`}>
                      {signal.type}
                    </span>
                    <div style={{ color: 'var(--text-muted)', marginTop: '4px', fontSize: '0.7rem' }}>
                      {formatTime(signal.createdTime)} · {signal.confidence}%
                    </div>
                  </td>
                  <td>{formatZone(signal)}</td>
                  <td>{signal.sl.toFixed(2)}</td>
                  <td>{signal.tp1.toFixed(2)}</td>
                  <td>
                    <span className={`badge ${signal.status === 'limit_hit' ? 'limit-hit' : 'waiting-limit'}`}>
                      {signal.status === 'limit_hit' ? 'Hit' : 'Waiting'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
