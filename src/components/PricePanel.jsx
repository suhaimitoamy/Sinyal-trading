import React, { useEffect, useState } from 'react';

export default function PricePanel({ price }) {
  const [prevPrice, setPrevPrice] = useState(null);
  const [flashClass, setFlashClass] = useState('');

  useEffect(() => {
    if (price && prevPrice) {
      if (price > prevPrice) {
        setFlashClass('price-up');
      } else if (price < prevPrice) {
        setFlashClass('price-down');
      }
      const timer = setTimeout(() => setFlashClass(''), 1000);
      setPrevPrice(price);
      return () => clearTimeout(timer);
    }
    setPrevPrice(price);
  }, [price]);

  return (
    <div className={`price-display ${flashClass}`}>
      {price ? price.toFixed(2) : '---.--'}
    </div>
  );
}
