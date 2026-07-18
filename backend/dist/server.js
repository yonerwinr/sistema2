"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const db_1 = __importDefault(require("./config/db"));
const auth_1 = __importDefault(require("./controllers/auth"));
const products_1 = __importDefault(require("./controllers/products"));
const sales_1 = __importDefault(require("./controllers/sales"));
const stats_1 = __importDefault(require("./controllers/stats"));
const reminders_1 = require("./services/reminders");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// Middlewares
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Servir imagenes estaticas o assets si es necesario
// app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
// Rutas de la API
app.use('/api/auth', auth_1.default);
app.use('/api/products', products_1.default);
app.use('/api/sales', sales_1.default);
app.use('/api/stats', stats_1.default);
// Ruta raiz de prueba
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Servidor POS Online funcionando correctamente' });
});
// Función de migraciones automáticas
async function runMigrations() {
    const conn = await db_1.default.getConnection();
    try {
        console.log('Iniciando migraciones de base de datos...');
        // Verificar si existen las columnas en la tabla sales
        const [columns] = await conn.query('SHOW COLUMNS FROM sales');
        const columnNames = columns.map((c) => c.Field);
        if (!columnNames.includes('discount')) {
            await conn.query('ALTER TABLE sales ADD COLUMN discount DECIMAL(10, 2) NOT NULL DEFAULT 0.00');
            console.log('Columna "discount" agregada a la tabla sales.');
        }
        if (!columnNames.includes('tax')) {
            await conn.query('ALTER TABLE sales ADD COLUMN tax DECIMAL(10, 2) NOT NULL DEFAULT 0.00');
            console.log('Columna "tax" agregada a la tabla sales.');
        }
        if (!columnNames.includes('is_quotation')) {
            await conn.query('ALTER TABLE sales ADD COLUMN is_quotation TINYINT NOT NULL DEFAULT 0');
            console.log('Columna "is_quotation" agregada a la tabla sales.');
        }
        if (!columnNames.includes('amount_paid')) {
            await conn.query('ALTER TABLE sales ADD COLUMN amount_paid DECIMAL(10, 2) NOT NULL DEFAULT 0.00');
            console.log('Columna "amount_paid" agregada a la tabla sales.');
            await conn.query("UPDATE sales SET amount_paid = total WHERE status = 'completed'");
        }
        if (!columnNames.includes('last_reminder_sent_at')) {
            await conn.query('ALTER TABLE sales ADD COLUMN last_reminder_sent_at TIMESTAMP NULL DEFAULT NULL');
            console.log('Columna "last_reminder_sent_at" agregada a la tabla sales.');
        }
        // Crear tabla de cupones si no existe
        await conn.query(`
      CREATE TABLE IF NOT EXISTS coupons (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(50) NOT NULL UNIQUE,
        discount_percent DECIMAL(5,2) NOT NULL,
        active TINYINT NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);
        // Añadir columnas para cupones personales y de un solo uso
        const [couponColumns] = await conn.query('SHOW COLUMNS FROM coupons');
        const couponColumnNames = couponColumns.map((col) => col.Field);
        if (!couponColumnNames.includes('user_id')) {
            await conn.query('ALTER TABLE coupons ADD COLUMN user_id INT NULL');
            console.log('Columna "user_id" agregada a la tabla coupons.');
        }
        if (!couponColumnNames.includes('is_used')) {
            await conn.query('ALTER TABLE coupons ADD COLUMN is_used TINYINT NOT NULL DEFAULT 0');
            console.log('Columna "is_used" agregada a la tabla coupons.');
        }
        // Insertar cupones por defecto si está vacía
        const [existingCoupons] = await conn.query('SELECT id FROM coupons LIMIT 1');
        if (existingCoupons.length === 0) {
            await conn.query(`
        INSERT INTO coupons (code, discount_percent) VALUES 
        ('DESCUENTO10', 10.00),
        ('BIENVENIDA20', 20.00),
        ('PROMO15', 15.00)
      `);
            console.log('Cupones por defecto agregados.');
        }
        // Crear tabla de settings si no existe
        await conn.query(`
      CREATE TABLE IF NOT EXISTS settings (
        settings_key VARCHAR(50) PRIMARY KEY,
        settings_value TEXT NOT NULL
      ) ENGINE=InnoDB;
    `);
        // Insertar configuraciones por defecto si no existen
        const [existingSettings] = await conn.query('SELECT settings_key FROM settings LIMIT 1');
        if (existingSettings.length === 0) {
            await conn.query(`
        INSERT INTO settings (settings_key, settings_value) VALUES 
        ('debtor_reminder_frequency_days', '7'),
        ('debtor_reminder_email_template', 'Hola {customerName},\\n\\nTe recordamos amablemente que tienes un saldo pendiente de \${amountPending} de tu compra con factura #{saleId}.\\n\\nPor favor realiza el pago correspondiente lo antes posible para saldar tu cuenta.\\n\\n¡Muchas gracias por tu preferencia!')
      `);
            console.log('Configuraciones iniciales insertadas.');
        }
        console.log('Migraciones completadas exitosamente.');
    }
    catch (error) {
        console.error('Error al ejecutar migraciones de base de datos:', error);
    }
    finally {
        conn.release();
    }
}
// Arrancar Servidor
runMigrations().then(() => {
    app.listen(PORT, () => {
        console.log(`==========================================================`);
        console.log(`🚀 Servidor backend POS Online corriendo en puerto ${PORT}`);
        console.log(`🔗 API Health: http://localhost:${PORT}/api/health`);
        console.log(`==========================================================`);
        // Iniciar cron de recordatorio de deudas en segundo plano
        (0, reminders_1.startReminderCron)();
    });
});
