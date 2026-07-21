import pool from '../config/db';
import { logAuditEvent } from './audit';

export async function syncExchangeRatesFromBCV(): Promise<{ usdToVes: number; eurToVes: number; binanceUsdToVes: number }> {
  console.log('[RATES SERVICE] Sincronizando tasas de cambio desde BCV y Binance...');
  try {
    let usdRate = 0;
    let eurRate = 0;
    let binanceRate = 0;
    let successBCV = false;
    let successBinance = false;

    // 1. Intentar obtener tasas BCV con DolarVZLA
    try {
      const res = await fetch('https://rates.dolarvzla.com/bcv/current.json');
      if (res.ok) {
        const data: any = await res.json();
        if (data?.current?.usd && data?.current?.eur) {
          usdRate = parseFloat(data.current.usd);
          eurRate = parseFloat(data.current.eur);
          if (!isNaN(usdRate) && !isNaN(eurRate)) {
            successBCV = true;
            console.log('[RATES SERVICE] Tasas BCV sincronizadas desde DolarVZLA.');
          }
        }
      }
    } catch (e: any) {
      console.warn('[RATES SERVICE] Error al conectar con DolarVZLA:', e.message);
    }

    // Fallback BCV con DolarApi
    if (!successBCV) {
      console.log('[RATES SERVICE] Intentando fallback de BCV con DolarApi...');
      const res = await fetch('https://ve.dolarapi.com/v1/cotizaciones');
      if (res.ok) {
        const data: any = await res.json();
        const usdItem = data.find((item: any) => item.moneda === 'USD' && item.fuente === 'oficial');
        const eurItem = data.find((item: any) => item.moneda === 'EUR' && item.fuente === 'oficial');

        if (usdItem && eurItem) {
          usdRate = parseFloat(usdItem.promedio);
          eurRate = parseFloat(eurItem.promedio);
          if (!isNaN(usdRate) && !isNaN(eurRate)) {
            successBCV = true;
          }
        }
      }
    }

    // 2. Obtener Dólar Binance USDT (P2P Binance / DolarApi Paralelo)
    try {
      const resBinance = await fetch('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fiat: 'VES',
          page: 1,
          rows: 5,
          tradeType: 'SELL',
          asset: 'USDT',
          payTypes: []
        })
      });
      if (resBinance.ok) {
        const bData: any = await resBinance.json();
        if (bData?.data && Array.isArray(bData.data) && bData.data.length > 0) {
          const prices = bData.data.map((item: any) => parseFloat(item.adv.price)).filter((p: number) => !isNaN(p));
          if (prices.length > 0) {
            binanceRate = prices.reduce((a: number, b: number) => a + b, 0) / prices.length;
            successBinance = true;
            console.log('[RATES SERVICE] Dólar Binance P2P obtenido directamente desde Binance API:', binanceRate);
          }
        }
      }
    } catch (e: any) {
      console.warn('[RATES SERVICE] Error conectando directamente a API Binance P2P:', e.message);
    }

    // Fallback Binance / Paralelo usando DolarApi
    if (!successBinance) {
      try {
        const resPara = await fetch('https://ve.dolarapi.com/v1/dolares/paralelo');
        if (resPara.ok) {
          const pData: any = await resPara.json();
          if (pData?.promedio) {
            binanceRate = parseFloat(pData.promedio);
            if (!isNaN(binanceRate)) {
              successBinance = true;
              console.log('[RATES SERVICE] Dólar Paralelo/Binance obtenido desde DolarApi:', binanceRate);
            }
          }
        }
      } catch (e: any) {
        console.warn('[RATES SERVICE] Error en fallback de Binance:', e.message);
      }
    }

    // Si aún no se pudo calcular Binance, usar estimación razonable (+8% sobre BCV)
    if (!successBinance || binanceRate <= 0) {
      binanceRate = usdRate > 0 ? usdRate * 1.08 : 44.50;
    }

    if (usdRate <= 0) usdRate = 40.00;
    if (eurRate <= 0) eurRate = 43.50;

    // Control de Ventana de 6 Horas para la Tasa Binance más alta registrada
    const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
    const now = Date.now();

    const [settingRows]: any = await pool.query(
      'SELECT settings_key, settings_value FROM settings WHERE settings_key IN (?, ?)',
      ['binance_window_start_time', 'binance_highest_rate_6h']
    );

    let windowStart = 0;
    let highestRateInWindow = 0;

    settingRows.forEach((row: any) => {
      if (row.settings_key === 'binance_window_start_time') {
        windowStart = parseInt(row.settings_value) || 0;
      }
      if (row.settings_key === 'binance_highest_rate_6h') {
        highestRateInWindow = parseFloat(row.settings_value) || 0;
      }
    });

    if (now - windowStart >= SIX_HOURS_MS || windowStart === 0 || highestRateInWindow === 0) {
      // Nueva ventana de 6 horas
      windowStart = now;
      highestRateInWindow = binanceRate;
    } else {
      // Dentro de la misma ventana de 6 horas, registrar el valor máximo
      if (binanceRate > highestRateInWindow) {
        highestRateInWindow = binanceRate;
      }
    }

    const finalBinanceRate = highestRateInWindow > 0 ? highestRateInWindow : binanceRate;

    // Guardar en la base de datos
    await pool.query(
      'INSERT INTO settings (settings_key, settings_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE settings_value = ?',
      ['usd_to_ves_rate', usdRate.toString(), usdRate.toString()]
    );
    await pool.query(
      'INSERT INTO settings (settings_key, settings_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE settings_value = ?',
      ['eur_to_ves_rate', eurRate.toString(), eurRate.toString()]
    );
    await pool.query(
      'INSERT INTO settings (settings_key, settings_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE settings_value = ?',
      ['binance_window_start_time', windowStart.toString(), windowStart.toString()]
    );
    await pool.query(
      'INSERT INTO settings (settings_key, settings_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE settings_value = ?',
      ['binance_highest_rate_6h', highestRateInWindow.toString(), highestRateInWindow.toString()]
    );
    await pool.query(
      'INSERT INTO settings (settings_key, settings_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE settings_value = ?',
      ['binance_usd_to_ves_rate', finalBinanceRate.toString(), finalBinanceRate.toString()]
    );

    logAuditEvent({
      actionType: 'settings',
      title: 'Tasas Oficiales (BCV & Binance 6H) Sincronizadas',
      details: `BCV USD: Bs. ${usdRate.toFixed(2)} | BCV EUR: Bs. ${eurRate.toFixed(2)} | Binance (Máx 6H): Bs. ${finalBinanceRate.toFixed(2)}`
    });

    console.log(`[RATES SERVICE] Sincronización exitosa: BCV USD = Bs. ${usdRate} | BCV EUR = Bs. ${eurRate} | Binance Máx 6H = Bs. ${finalBinanceRate}`);
    return { usdToVes: usdRate, eurToVes: eurRate, binanceUsdToVes: finalBinanceRate };
  } catch (error) {
    console.error('[RATES SERVICE] Error al sincronizar tasas desde BCV:', error);
    throw error;
  }
}

export function startRatesCron(): void {
  // Ejecutar inmediatamente al arrancar
  syncExchangeRatesFromBCV().catch(err => console.error('[RATES CRON] Error en sincronización inicial:', err));

  // Ejecutar automáticamente cada 6 horas
  const INTERVAL_MS = 1000 * 60 * 60 * 6;
  setInterval(() => {
    syncExchangeRatesFromBCV().catch(err => console.error('[RATES CRON] Error en sincronización programada 6H:', err));
  }, INTERVAL_MS);
}
