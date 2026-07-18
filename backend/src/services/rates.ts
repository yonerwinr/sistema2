import pool from '../config/db';

export async function syncExchangeRatesFromBCV(): Promise<{ usdToVes: number; eurToVes: number }> {
  console.log('[RATES SERVICE] Sincronizando tasas de cambio desde BCV (DolarApi)...');
  try {
    const res = await fetch('https://ve.dolarapi.com/v1/cotizaciones');
    if (!res.ok) {
      throw new Error(`Error en respuesta de DolarApi: ${res.statusText}`);
    }

    const data: any = await res.json();
    const usdItem = data.find((item: any) => item.moneda === 'USD' && item.fuente === 'oficial');
    const eurItem = data.find((item: any) => item.moneda === 'EUR' && item.fuente === 'oficial');

    if (!usdItem || !eurItem) {
      throw new Error('No se encontraron las cotizaciones oficiales de USD/EUR en la respuesta.');
    }

    const usdRate = parseFloat(usdItem.promedio);
    const eurRate = parseFloat(eurItem.promedio);

    if (isNaN(usdRate) || isNaN(eurRate)) {
      throw new Error('Las tasas obtenidas no son números válidos.');
    }

    // Guardar en la base de datos
    await pool.query(
      'INSERT INTO settings (settings_key, settings_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE settings_value = ?',
      ['usd_to_ves_rate', usdRate.toString(), usdRate.toString()]
    );
    await pool.query(
      'INSERT INTO settings (settings_key, settings_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE settings_value = ?',
      ['eur_to_ves_rate', eurRate.toString(), eurRate.toString()]
    );

    console.log(`[RATES SERVICE] Sincronización exitosa: USD = Bs. ${usdRate} | EUR = Bs. ${eurRate}`);
    return { usdToVes: usdRate, eurToVes: eurRate };
  } catch (error) {
    console.error('[RATES SERVICE] Error al sincronizar tasas desde BCV:', error);
    throw error;
  }
}

export function startRatesCron(): void {
  // Ejecutar inmediatamente al arrancar
  syncExchangeRatesFromBCV().catch(err => console.error('[RATES CRON] Error en sincronización inicial:', err));

  // Ejecutar cada 4 horas
  const INTERVAL_MS = 1000 * 60 * 60 * 4;
  setInterval(() => {
    syncExchangeRatesFromBCV().catch(err => console.error('[RATES CRON] Error en sincronización programada:', err));
  }, INTERVAL_MS);
}
