import React from 'react';

export default function SweepPanel({ sweeps }) {
  const sorted = [...sweeps].sort((a, b) => b.time - a.time).slice(0, 10);
  const formatTime = (ts) => new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="panel">
      <h3>Sweeps</h3>
      <div className="panel-content">
        {sorted.length === 0 ? (
          <div style={{ color: 'var(--text-muted)' }}>No sweeps detected</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Level</th>
                <th>Price</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(sweep => (
                <tr key={sweep.id}>
                  <td>
                    <span className="badge sweep">
                      {sweep.type === 'high_sweep' ? 'High Sweep' : 'Low Sweep'}
                    </span>
                  </td>
                  <td>{sweep.levelName}</td>
                  <td>{sweep.sweepPrice.toFixed(2)}</td>
                  <td>{formatTime(sweep.time)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
