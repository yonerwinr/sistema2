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
const rates_1 = require("./services/rates");
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
        // Modificar columna role para permitir 'seller'
        try {
            await conn.query("ALTER TABLE users MODIFY COLUMN role ENUM('admin', 'customer', 'seller') DEFAULT 'customer'");
            console.log('Columna "role" de la tabla users modificada para incluir "seller".');
        }
        catch (err) {
            console.error('Error al modificar columna role:', err.message);
        }
        // Verificar y agregar columna ci a la tabla users
        try {
            const [userCols] = await conn.query('SHOW COLUMNS FROM users');
            const userColNames = userCols.map((c) => c.Field);
            if (!userColNames.includes('ci')) {
                await conn.query('ALTER TABLE users ADD COLUMN ci VARCHAR(30) NULL UNIQUE');
                console.log('Columna "ci" agregada a la tabla users.');
            }
        }
        catch (err) {
            console.error('Error al agregar columna ci a la tabla users:', err.message);
        }
        // Verificar y agregar columna customer_ci a la tabla sales
        try {
            const [salesCols] = await conn.query('SHOW COLUMNS FROM sales');
            const salesColNames = salesCols.map((c) => c.Field);
            if (!salesColNames.includes('customer_ci')) {
                await conn.query('ALTER TABLE sales ADD COLUMN customer_ci VARCHAR(30) NULL');
                console.log('Columna "customer_ci" agregada a la tabla sales.');
            }
        }
        catch (err) {
            console.error('Error al agregar columna customer_ci a la tabla sales:', err.message);
        }
        // Verificar y agregar columna seller_id a la tabla sales
        try {
            const [salesCols] = await conn.query('SHOW COLUMNS FROM sales');
            const salesColNames = salesCols.map((c) => c.Field);
            if (!salesColNames.includes('seller_id')) {
                await conn.query('ALTER TABLE sales ADD COLUMN seller_id INT NULL, ADD FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE SET NULL');
                console.log('Columna "seller_id" agregada a la tabla sales.');
            }
        }
        catch (err) {
            console.error('Error al agregar columna seller_id a la tabla sales:', err.message);
        }
        // Modificar columna payment_method para permitir VARCHAR(50)
        try {
            await conn.query("ALTER TABLE sales MODIFY COLUMN payment_method VARCHAR(50) NOT NULL DEFAULT 'cash'");
            console.log('Columna "payment_method" de la tabla sales modificada a VARCHAR(50).');
        }
        catch (err) {
            console.error('Error al modificar columna payment_method:', err.message);
        }
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
        if (!columnNames.includes('coupon_code')) {
            await conn.query('ALTER TABLE sales ADD COLUMN coupon_code VARCHAR(50) NULL');
            console.log('Columna "coupon_code" agregada a la tabla sales.');
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
        await conn.query(`
      INSERT IGNORE INTO settings (settings_key, settings_value) VALUES 
      ('debtor_reminder_frequency_days', '7'),
      ('debtor_reminder_email_template', 'Hola {customerName},\\n\\nTe recordamos amablemente que tienes un saldo pendiente de \${amountPending} de tu compra con factura #{saleId}.\\n\\nPor favor realiza el pago correspondiente lo antes posible para saldar tu cuenta.\\n\\n¡Muchas gracias por tu preferencia!'),
      ('usd_to_ves_rate', '40.00'),
      ('eur_to_ves_rate', '43.50')
    `);
        console.log('Configuraciones iniciales de tasas y recordatorios verificadas.');
        // Insertar vendedor de prueba si no existe
        const [existingSeller] = await conn.query("SELECT id FROM users WHERE email = 'vendedor@sistema.com' LIMIT 1");
        if (existingSeller.length === 0) {
            await conn.query(`
        INSERT INTO users (name, email, password, role, phone) 
        VALUES ('Vendedor', 'vendedor@sistema.com', '$2a$10$vOcp1PI6sKSr3gRv6TMwSOW.SnrMNn.OGN70l8ZTitvT6FkL3TYi.', 'seller', '+584120000000')
      `);
            console.log('Usuario vendedor registrado con éxito (contraseña: vendedor123).');
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
        // Iniciar cron de actualización automática de tasas BCV en segundo plano
        (0, rates_1.startRatesCron)();
    });
});
