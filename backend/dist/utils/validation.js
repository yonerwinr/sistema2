"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateCi = validateCi;
/**
 * Valida el formato de Cédula o RIF según las reglas:
 * V/E: 6 a 8 dígitos numéricos.
 * J/G: exactamente 9 dígitos numéricos.
 * Otros prefijos (ej: P para Pasaporte): de 5 a 15 caracteres alfanuméricos.
 */
function validateCi(ci) {
    if (!ci)
        return false;
    const parts = ci.split('-');
    if (parts.length !== 2)
        return false;
    const prefix = parts[0].toUpperCase();
    const num = parts[1];
    if (prefix === 'V' || prefix === 'E') {
        return /^\d{6,8}$/.test(num);
    }
    if (prefix === 'J' || prefix === 'G') {
        return /^\d{9}$/.test(num);
    }
    // Pasaporte 'P' o similar
    return /^[a-zA-Z0-9]{5,15}$/.test(num);
}
