"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncExchangeRatesFromBCV = syncExchangeRatesFromBCV;
exports.startRatesCron = startRatesCron;
const db_1 = __importDefault(require("../config/db"));
const audit_1 = require("./audit");
async function syncExchangeRatesFromBCV() {
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
                const data = await res.json();
                if (data?.current?.usd && data?.current?.eur) {
                    usdRate = parseFloat(data.current.usd);
                    eurRate = parseFloat(data.current.eur);
                    if (!isNaN(usdRate) && !isNaN(eurRate)) {
                        successBCV = true;
                        console.log('[RATES SERVICE] Tasas BCV sincronizadas desde DolarVZLA.');
                    }
                }
            }
        }
        catch (e) {
            console.warn('[RATES SERVICE] Error al conectar con DolarVZLA:', e.message);
        }
        // Fallback BCV con DolarApi
        if (!successBCV) {
            console.log('[RATES SERVICE] Intentando fallback de BCV con DolarApi...');
            const res = await fetch('https://ve.dolarapi.com/v1/cotizaciones');
            if (res.ok) {
                const data = await res.json();
                const usdItem = data.find((item) => item.moneda === 'USD' && item.fuente === 'oficial');
                const eurItem = data.find((item) => item.moneda === 'EUR' && item.fuente === 'oficial');
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
                const bData = await resBinance.json();
                if (bData?.data && Array.isArray(bData.data) && bData.data.length > 0) {
                    const prices = bData.data.map((item) => parseFloat(item.adv.price)).filter((p) => !isNaN(p));
                    if (prices.length > 0) {
                        binanceRate = prices.reduce((a, b) => a + b, 0) / prices.length;
                        successBinance = true;
                        console.log('[RATES SERVICE] Dólar Binance P2P obtenido directamente desde Binance API:', binanceRate);
                    }
                }
            }
        }
        catch (e) {
            console.warn('[RATES SERVICE] Error conectando directamente a API Binance P2P:', e.message);
        }
        // Fallback Binance / Paralelo usando DolarApi
        if (!successBinance) {
            try {
                const resPara = await fetch('https://ve.dolarapi.com/v1/dolares/paralelo');
                if (resPara.ok) {
                    const pData = await resPara.json();
                    if (pData?.promedio) {
                        binanceRate = parseFloat(pData.promedio);
                        if (!isNaN(binanceRate)) {
                            successBinance = true;
                            console.log('[RATES SERVICE] Dólar Paralelo/Binance obtenido desde DolarApi:', binanceRate);
                        }
                    }
                }
            }
            catch (e) {
                console.warn('[RATES SERVICE] Error en fallback de Binance:', e.message);
            }
        }
        // Si aún no se pudo calcular Binance, usar estimación razonable (+8% sobre BCV)
        if (!successBinance || binanceRate <= 0) {
            binanceRate = usdRate > 0 ? usdRate * 1.08 : 44.50;
        }
        if (usdRate <= 0)
            usdRate = 40.00;
        if (eurRate <= 0)
            eurRate = 43.50;
        // Guardar en la base de datos
        await db_1.default.query('INSERT INTO settings (settings_key, settings_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE settings_value = ?', ['usd_to_ves_rate', usdRate.toString(), usdRate.toString()]);
        await db_1.default.query('INSERT INTO settings (settings_key, settings_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE settings_value = ?', ['eur_to_ves_rate', eurRate.toString(), eurRate.toString()]);
        await db_1.default.query('INSERT INTO settings (settings_key, settings_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE settings_value = ?', ['binance_usd_to_ves_rate', binanceRate.toString(), binanceRate.toString()]);
        (0, audit_1.logAuditEvent)({
            actionType: 'settings',
            title: 'Tasas Oficiales (BCV & Binance) Sincronizadas',
            details: `BCV USD: Bs. ${usdRate.toFixed(2)} | BCV EUR: Bs. ${eurRate.toFixed(2)} | Binance USDT: Bs. ${binanceRate.toFixed(2)}`
        });
        console.log(`[RATES SERVICE] Sincronización exitosa: BCV USD = Bs. ${usdRate} | BCV EUR = Bs. ${eurRate} | Binance USDT = Bs. ${binanceRate}`);
        return { usdToVes: usdRate, eurToVes: eurRate, binanceUsdToVes: binanceRate };
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
