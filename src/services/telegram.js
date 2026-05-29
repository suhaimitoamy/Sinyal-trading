import { getTelegramSettings } from './storage';

export async function sendTelegramMessage(message) {
  const { botToken, chatId } = getTelegramSettings();
  if (!botToken || !chatId || !message) {
    return { ok: false, reason: 'telegram_not_configured' };
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.warn('[telegram] Send failed:', result);
      return { ok: false, reason: result.description || 'send_failed' };
    }

    return { ok: true, result };
  } catch (err) {
    console.warn('[telegram] Send error:', err);
    return { ok: false, reason: err.message || 'network_error' };
  }
}

export function formatTradeSignalMessage(signal) {
  if (!signal) return '';

  const icon = signal.side === 'sell' ? '🔴' : '🟢';
  const entry = `${formatPrice(signal.entryLow)} - ${formatPrice(signal.entryHigh)}`;

  return [
    `${icon} <b>${signal.symbol} ${signal.type}</b>`,
    `TF: <b>${signal.timeframe?.toUpperCase?.() || '-'}</b>`,
    `Entry: <b>${entry}</b>`,
    `SL: <b>${formatPrice(signal.sl)}</b>`,
    `TP1: <b>${formatPrice(signal.tp1)}</b>`,
    `TP2: <b>${formatPrice(signal.tp2)}</b>`,
    `Confidence: <b>${signal.confidence}%</b>`,
    `Alasan: ${escapeHtml((signal.rationale || []).join(' + '))}`,
    `Status: Menunggu harga masuk limit`,
  ].join('\n');
}

export function formatLimitHitMessage(hit) {
  const signal = hit?.signal;
  if (!signal) return '';

  const icon = signal.side === 'sell' ? '🔴' : '🟢';
  return [
    `${icon} <b>${signal.symbol} LIMIT HIT</b>`,
    `Setup: <b>${signal.type}</b>`,
    `Hit Price: <b>${formatPrice(hit.price)}</b>`,
    `Entry Zone: <b>${formatPrice(signal.entryLow)} - ${formatPrice(signal.entryHigh)}</b>`,
    `SL: <b>${formatPrice(signal.sl)}</b>`,
    `TP1: <b>${formatPrice(signal.tp1)}</b>`,
    `TP2: <b>${formatPrice(signal.tp2)}</b>`,
  ].join('\n');
}

function formatPrice(value) {
  return Number.isFinite(value) ? value.toFixed(2) : '-';
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
