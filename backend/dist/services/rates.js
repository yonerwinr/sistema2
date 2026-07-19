"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncExchangeRatesFromBCV = syncExchangeRatesFromBCV;
exports.startRatesCron = startRatesCron;
const db_1 = __importDefault(require("../config/db"));
async function syncExchangeRatesFromBCV() {
    console.log('[RATES SERVICE] Sincronizando tasas de cambio desde BCV...');
    try {
        let usdRate = 0;
        let eurRate = 0;
        let success = false;
        // Intentar primero con DolarVZLA (más actualizado y en tiempo real con la web del BCV)
        try {
            const res = await fetch('https://rates.dolarvzla.com/bcv/current.json');
            if (res.ok) {
                const data = await res.json();
                if (data?.current?.usd && data?.current?.eur) {
                    usdRate = parseFloat(data.current.usd);
                    eurRate = parseFloat(data.current.eur);
                    if (!isNaN(usdRate) && !isNaN(eurRate)) {
                        success = true;
                        console.log('[RATES SERVICE] Sincronizado exitosamente desde DolarVZLA.');
                    }
                }
            }
        }
        catch (e) {
            console.warn('[RATES SERVICE] Error intentando sincronizar con DolarVZLA:', e.message);
        }
        // Fallback a DolarApi si DolarVZLA falló
        if (!success) {
            console.log('[RATES SERVICE] Intentando fallback con DolarApi...');
            const res = await fetch('https://ve.dolarapi.com/v1/cotizaciones');
            if (!res.ok) {
                throw new Error(`Error en respuesta de DolarApi: ${res.statusText}`);
            }
            const data = await res.json();
            const usdItem = data.find((item) => item.moneda === 'USD' && item.fuente === 'oficial');
            const eurItem = data.find((item) => item.moneda === 'EUR' && item.fuente === 'oficial');
            if (!usdItem || !eurItem) {
                throw new Error('No se encontraron las cotizaciones oficiales de USD/EUR en DolarApi.');
            }
            usdRate = parseFloat(usdItem.promedio);
            eurRate = parseFloat(eurItem.promedio);
            if (isNaN(usdRate) || isNaN(eurRate)) {
                throw new Error('Las tasas obtenidas de DolarApi no son números válidos.');
            }
        }
        // Guardar en la base de datos
        await db_1.default.query('INSERT INTO settings (settings_key, settings_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE settings_value = ?', ['usd_to_ves_rate', usdRate.toString(), usdRate.toString()]);
        await db_1.default.query('INSERT INTO settings (settings_key, settings_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE settings_value = ?', ['eur_to_ves_rate', eurRate.toString(), eurRate.toString()]);
        console.log(`[RATES SERVICE] Sincronización exitosa: USD = Bs. ${usdRate} | EUR = Bs. ${eurRate}`);
        return { usdToVes: usdRate, eurToVes: eurRate };
    }
    catch (error) {
        console.error('[RATES SERVICE] Error al sincronizar tasas desde BCV:', error);
        throw error;
    }
}
function startRatesCron() {
    // Ejecutar inmediatamente al arrancar
    syncExchangeRatesFromBCV().catch(err => console.error('[RATES CRON] Error en sincronización inicial:', err));
    // Ejecutar cada 4 horas
    const INTERVAL_MS = 1000 * 60 * 60 * 4;
    setInterval(() => {
        syncExchangeRatesFromBCV().catch(err => console.error('[RATES CRON] Error en sincronización programada:', err));
    }, INTERVAL_MS);
}
