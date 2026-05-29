import React from 'react';

export default function SessionLevelPanel({ levels, sessionStatus }) {
  const data = [
    { name: 'Asia High', price: levels.asiaHigh, active: sessionStatus.asia },
    { name: 'Asia Low', price: levels.asiaLow, active: sessionStatus.asia },
    { name: 'London High', price: levels.londonHigh, active: sessionStatus.london },
    { name: 'London Low', price: levels.londonLow, active: sessionStatus.london },
    { name: 'New York High', price: levels.nyHigh, active: sessionStatus.ny },
    { name: 'New York Low', price: levels.nyLow, active: sessionStatus.ny },
    { name: 'Previous Day High', price: levels.prevDayHigh, active: false },
    { name: 'Previous Day Low', price: levels.prevDayLow, active: false },
  ].filter(item => item.price != null);

  return (
    <div className="panel">
      <h3>Session Levels</h3>
      <div className="panel-content">
        {data.length === 0 ? (
          <div style={{ color: 'var(--text-muted)' }}>No data yet</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Level</th>
                <th>Price</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.map(item => (
                <tr key={item.name}>
                  <td>{item.name}</td>
                  <td>{item.price.toFixed(2)}</td>
                  <td style={{ color: item.active ? 'var(--accent-gold)' : 'var(--text-muted)' }}>
                    {item.active ? 'Active' : 'Locked'}
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
