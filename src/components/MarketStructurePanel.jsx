import React from 'react';

export default function MarketStructurePanel({ trend, events }) {
  const sorted = [...events].sort((a, b) => b.time - a.time).slice(0, 10);
  const formatTime = (ts) => new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const formatPrice = (value) => Number.isFinite(value) ? value.toFixed(2) : '-';

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
                const { badgeClass, label } = eventBadge(ev);
                const price = ev.price ?? ev.breakoutPrice ?? ev.closePrice;
                const level = ev.level ?? ev.levelPrice;

                return (
                  <tr key={ev.id}>
                    <td><span className={`badge ${badgeClass}`}>{label}</span></td>
                    <td>{formatPrice(price)}</td>
                    <td>{formatPrice(level)}</td>
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

function eventBadge(ev) {
  if (ev.type === 'valid_break_bullish') return { badgeClass: 'valid-break', label: 'Valid Bull' };
  if (ev.type === 'valid_break_bearish') return { badgeClass: 'valid-break', label: 'Valid Bear' };
  if (ev.type === 'fake_break_bullish') return { badgeClass: 'fake-break', label: 'Fake Bull' };
  if (ev.type === 'fake_break_bearish') return { badgeClass: 'fake-break', label: 'Fake Bear' };
  if (ev.type?.includes('breakout')) {
    return { badgeClass: 'breakout', label: ev.type === 'breakout_bullish' ? 'Brk Bull' : 'Brk Bear' };
  }
  if (ev.type === 'bos') {
    return { badgeClass: 'bos', label: ev.direction === 'bullish' ? 'BOS Bull' : 'BOS Bear' };
  }
  if (ev.type === 'choch') {
    return { badgeClass: 'choch', label: ev.direction === 'bullish' ? 'CHoCH Bull' : 'CHoCH Bear' };
  }
  return { badgeClass: 'badge-outline', label: ev.type || '-' };
}
