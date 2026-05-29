import React from 'react';

export default function SwingPanel({ swings }) {
  const allSwings = [...(swings.confirmed || []), ...(swings.candidates || [])]
    .sort((a, b) => b.time - a.time)
    .slice(0, 10); // Show last 10

  const formatTime = (ts) => new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="panel">
      <h3>Swing Points</h3>
      <div className="panel-content">
        {allSwings.length === 0 ? (
          <div style={{ color: 'var(--text-muted)' }}>Waiting for data...</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Price</th>
                <th>Time</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {allSwings.map((swing, idx) => (
                <tr key={idx}>
                  <td>
                    <span className={`badge ${swing.type === 'high' ? 'sh' : 'sl'} ${swing.status === 'candidate' ? 'badge-outline' : ''}`}>
                      {swing.type === 'high' ? 'Swing High' : 'Swing Low'}
                    </span>
                  </td>
                  <td>{swing.price.toFixed(2)}</td>
                  <td>{formatTime(swing.time)}</td>
                  <td>{swing.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
