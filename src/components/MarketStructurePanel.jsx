import React from 'react';

export default function MarketStructurePanel({ trend, events }) {
  const sorted = [...events].sort((a, b) => b.time - a.time).slice(0, 10);
  const formatTime = (ts) => new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px', borderBottom: '1px solid var(--border-color)', paddingBottom: '5px' }}>
        <h3>Market Structure</h3>
        <span style={{ fontSize: '0.8rem', color: trend === 'bullish' ? 'var(--bull-color)' : trend === 'bearish' ? 'var(--bear-color)' : 'var(--text-muted)' }}>
          Trend: {trend.toUpperCase()}
        </span>
      </div>
      <div className="panel-content">
        {sorted.length === 0 ? (
          <div style={{ color: 'var(--text-muted)' }}>Waiting for structure...</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Price</th>
                <th>Level</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(ev => {
                let badgeClass = '';
                let label = '';
                if (ev.type.includes('breakout')) {
                  badgeClass = 'breakout';
                  label = ev.type === 'breakout_bullish' ? 'Brk Bull' : 'Brk Bear';
                } else if (ev.type === 'bos') {
                  badgeClass = 'bos';
                  label = ev.direction === 'bullish' ? 'BOS Bull' : 'BOS Bear';
                } else if (ev.type === 'choch') {
                  badgeClass = 'choch';
                  label = ev.direction === 'bullish' ? 'CHoCH Bull' : 'CHoCH Bear';
                }

                return (
                  <tr key={ev.id}>
                    <td><span className={`badge ${badgeClass}`}>{label}</span></td>
                    <td>{ev.price ? ev.price.toFixed(2) : ev.breakoutPrice.toFixed(2)}</td>
                    <td>{ev.level ? ev.level.toFixed(2) : ev.levelPrice.toFixed(2)}</td>
                    <td>{formatTime(ev.time)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
