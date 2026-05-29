import React from 'react';

export default function TimeframeSelector({ active, onChange }) {
  const timeframes = ['m1', 'm5', 'm15', 'h1'];

  return (
    <div className="tf-selector">
      {timeframes.map(tf => (
        <button
          key={tf}
          className={`tf-btn ${active === tf ? 'active' : ''}`}
          onClick={() => onChange(tf)}
        >
          {tf.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
