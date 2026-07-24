import express from 'express';
import cors from 'cors';
import compression from 'compression';
import dotenv from 'dotenv';
import path from 'path';
import pool from './config/db';
import authRoutes from './controllers/auth';
import productRoutes from './controllers/products';
import saleRoutes from './controllers/sales';
import statsRoutes from './controllers/stats';
import expenseRoutes from './controllers/expenses';
import cashRoutes from './controllers/cash';
import supplierRoutes from './controllers/suppliers';
import { startReminderCron } from './services/reminders';
import { startRatesCron } from './services/rates';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(compression());
app.use(cors());
app.use(express.json());

// Servir imagenes estaticas o assets si es necesario
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Rutas de la API
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/cash', cashRoutes);
app.use('/api/suppliers', supplierRoutes);

// Ruta raiz de prueba
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Servidor FacilitoApp funcionando correctamente 🐒' });
});

// Función de migraciones automáticas
async function runMigrations() {
  const conn = await pool.getConnection();
  try {
    console.log('Iniciando migraciones de base de datos...');

    // Modificar columna role para permitir 'seller'
    try {
      await conn.query("ALTER TABLE users MODIFY COLUMN role ENUM('admin', 'customer', 'seller') DEFAULT 'customer'");
      console.log('Columna "role" de la tabla users modificada para incluir "seller".');
    } catch (err: any) {
      console.error('Error al modificar columna role:', err.message);
    }

    // Modificar columna password de la tabla users para que sea nullable (para login con Google)
    try {
      await conn.query('ALTER TABLE users MODIFY COLUMN password VARCHAR(255) NULL');
      console.log('Columna "password" de la tabla users modificada para permitir NULL (soporte Google).');
    } catch (err: any) {
      console.error('Error al modificar columna password en la tabla users:', err.message);
    }

    // Verificar y agregar columnas a la tabla users de forma resiliente
    try {
      const [userCols]: any = await conn.query('SHOW COLUMNS FROM users');
      const userColNames = userCols.map((c: any) => c.Field);

      if (!userColNames.includes('ci')) {
        try {
          await conn.query('ALTER TABLE users ADD COLUMN ci VARCHAR(30) NULL');
          console.log('Columna "ci" agregada a la tabla users.');
        } catch (err: any) {
          console.error('Error al agregar columna "ci":', err.message);
        }
      }
      if (!userColNames.includes('client_type')) {
        try {
          await conn.query('ALTER TABLE users ADD COLUMN client_type VARCHAR(20) DEFAULT "natural"');
          console.log('Columna "client_type" agregada a la tabla users.');
        } catch (err: any) {
          console.error('Error al agregar columna "client_type":', err.message);
        }
      }
      if (!userColNames.includes('representative_name')) {
        try {
          await conn.query('ALTER TABLE users ADD COLUMN representative_name VARCHAR(150) NULL');
          console.log('Columna "representative_name" agregada a la tabla users.');
        } catch (err: any) {
          console.error('Error al agregar columna "representative_name":', err.message);
        }
      }
      if (!userColNames.includes('representative_ci')) {
        try {
          await conn.query('ALTER TABLE users ADD COLUMN representative_ci VARCHAR(30) NULL');
          console.log('Columna "representative_ci" agregada a la tabla users.');
        } catch (err: any) {
          console.error('Error al agregar columna "representative_ci":', err.message);
        }
      }
      if (!userColNames.includes('representative_phone')) {
        try {
          await conn.query('ALTER TABLE users ADD COLUMN representative_phone VARCHAR(30) NULL');
          console.log('Columna "representative_phone" agregada a la tabla users.');
        } catch (err: any) {
          console.error('Error al agregar columna "representative_phone":', err.message);
        }
      }
      if (!userColNames.includes('representative_position')) {
        try {
          await conn.query('ALTER TABLE users ADD COLUMN representative_position VARCHAR(100) NULL');
          console.log('Columna "representative_position" agregada a la tabla users.');
        } catch (err: any) {
          console.error('Error al agregar columna "representative_position":', err.message);
        }
      }
      if (!userColNames.includes('reset_code')) {
        try {
          await conn.query('ALTER TABLE users ADD COLUMN reset_code VARCHAR(10) NULL, ADD COLUMN reset_code_expires_at DATETIME NULL');
          console.log('Columnas "reset_code" y "reset_code_expires_at" agregadas a la tabla users.');
        } catch (err: any) {
          console.error('Error al agregar columnas "reset_code":', err.message);
        }
      }
      if (!userColNames.includes('permissions')) {
        try {
          await conn.query('ALTER TABLE users ADD COLUMN permissions TEXT NULL');
          console.log('Columna "permissions" agregada a la tabla users.');
        } catch (err: any) {
          console.error('Error al agregar columna "permissions":', err.message);
        }
      }
    } catch (err: any) {
      console.error('Error al inspeccionar columnas de la tabla users:', err.message);
    }

    // Verificar y agregar columna customer_ci a la tabla sales
    try {
      const [salesCols]: any = await conn.query('SHOW COLUMNS FROM sales');
      const salesColNames = salesCols.map((c: any) => c.Field);
      if (!salesColNames.includes('customer_ci')) {
        await conn.query('ALTER TABLE sales ADD COLUMN customer_ci VARCHAR(30) NULL');
        console.log('Columna "customer_ci" agregada a la tabla sales.');
      }
      if (!salesColNames.includes('concept')) {
        await conn.query('ALTER TABLE sales ADD COLUMN concept VARCHAR(255) NULL');
        console.log('Columna "concept" agregada a la tabla sales.');
      }
      if (!salesColNames.includes('note')) {
        await conn.query('ALTER TABLE sales ADD COLUMN note TEXT NULL');
        console.log('Columna "note" agregada a la tabla sales.');
      }
    } catch (err: any) {
      console.error('Error al agregar columna customer_ci a la tabla sales:', err.message);
    }

    // Verificar y agregar columna seller_id a la tabla sales
    try {
      const [salesCols]: any = await conn.query('SHOW COLUMNS FROM sales');
      const salesColNames = salesCols.map((c: any) => c.Field);
      if (!salesColNames.includes('seller_id')) {
        await conn.query('ALTER TABLE sales ADD COLUMN seller_id INT NULL, ADD FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE SET NULL');
        console.log('Columna "seller_id" agregada a la tabla sales.');
      }
    } catch (err: any) {
      console.error('Error al agregar columna seller_id a la tabla sales:', err.message);
    }

    // Verificar y crear tabla audit_logs si no existe
    try {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NULL,
          user_name VARCHAR(255) NULL,
          user_role VARCHAR(50) NULL,
          action_type VARCHAR(50) NOT NULL,
          title VARCHAR(255) NOT NULL,
          details TEXT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('Tabla "audit_logs" lista para registro de auditoría.');
    } catch (err: any) {
      console.error('Error al crear tabla audit_logs:', err.message);
    }

    // Verificar y crear tabla coupons si no existe
    try {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS coupons (
          id INT AUTO_INCREMENT PRIMARY KEY,
          code VARCHAR(50) NOT NULL UNIQUE,
          discount_percent DECIMAL(5, 2) NOT NULL,
          user_id INT NULL,
          active TINYINT DEFAULT 1,
          is_used TINYINT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      console.log('Tabla "coupons" lista para cupones de descuento.');
    } catch (err: any) {
      console.error('Error al crear tabla coupons:', err.message);
    }

    // Verificar y agregar columna address a la tabla users
    try {
      const [userCols]: any = await conn.query('SHOW COLUMNS FROM users');
      const userColNames = userCols.map((c: any) => c.Field);
      if (!userColNames.includes('address')) {
        await conn.query('ALTER TABLE users ADD COLUMN address TEXT NULL');
        console.log('Columna "address" agregada a la tabla users.');
      }
    } catch (err: any) {
      console.error('Error al agregar columna address a la tabla users:', err.message);
    }

    // Verificar y agregar columna code a la tabla products
    try {
      const [prodCols]: any = await conn.query('SHOW COLUMNS FROM products');
      const prodColNames = prodCols.map((c: any) => c.Field);
      if (!prodColNames.includes('code')) {
        // En TiDB no se permite agregar columna con CONSTRAINT UNIQUE en la misma sentencia,
        // por lo que agregamos la columna primero y luego creamos el índice UNIQUE por separado.
        await conn.query('ALTER TABLE products ADD COLUMN code VARCHAR(50) NULL');
        console.log('Columna "code" agregada a la tabla products.');
        
        try {
          await conn.query('ALTER TABLE products ADD UNIQUE INDEX (code)');
          console.log('Índice UNIQUE agregado a la columna "code" de products.');
        } catch (idxErr: any) {
          console.error('Error al agregar índice UNIQUE a la columna code:', idxErr.message);
        }
      }
    } catch (err: any) {
      console.error('Error al agregar columna code a la tabla products:', err.message);
    }

    // Modificar columna payment_method para permitir TEXT (pagos mixtos ilimitados)
    try {
      await conn.query("ALTER TABLE sales MODIFY COLUMN payment_method TEXT NOT NULL");
      console.log('Columna "payment_method" de la tabla sales modificada a TEXT.');
    } catch (err: any) {
      console.error('Error al modificar columna payment_method:', err.message);
    }

    // Modificar columna product_id de la tabla sale_items a NULL (soporte Venta Libre)
    try {
      await conn.query('ALTER TABLE sale_items MODIFY COLUMN product_id INT NULL');
      console.log('Columna "product_id" en sale_items modificada a NULL para Venta Libre.');
    } catch (err: any) {
      console.error('Error al modificar columna product_id en sale_items:', err.message);
    }
    
    // Verificar si existen las columnas en la tabla sales
    const [columns]: any = await conn.query('SHOW COLUMNS FROM sales');
    const columnNames = columns.map((c: any) => c.Field);
    
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
    const [couponColumns]: any = await conn.query('SHOW COLUMNS FROM coupons');
    const couponColumnNames = couponColumns.map((col: any) => col.Field);
    if (!couponColumnNames.includes('code')) {
      await conn.query('ALTER TABLE coupons ADD COLUMN code VARCHAR(50) NOT NULL UNIQUE AFTER id');
      console.log('Columna "code" agregada a la tabla coupons.');
    }
    if (!couponColumnNames.includes('user_id')) {
      await conn.query('ALTER TABLE coupons ADD COLUMN user_id INT NULL');
      console.log('Columna "user_id" agregada a la tabla coupons.');
    }
    if (!couponColumnNames.includes('is_used')) {
      await conn.query('ALTER TABLE coupons ADD COLUMN is_used TINYINT NOT NULL DEFAULT 0');
      console.log('Columna "is_used" agregada a la tabla coupons.');
    }

    // Insertar cupones por defecto si está vacía
    const [existingCoupons]: any = await conn.query('SELECT id FROM coupons LIMIT 1');
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

    // Crear tablas de caja si no existen
    await conn.query(`
      CREATE TABLE IF NOT EXISTS cash_sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        closed_at TIMESTAMP NULL DEFAULT NULL,
        status ENUM('open', 'closed') DEFAULT 'open',
        opening_balance DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        expected_balance DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        actual_balance DECIMAL(10, 2) NULL DEFAULT NULL,
        difference DECIMAL(10, 2) NULL DEFAULT NULL,
        closed_by INT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS cash_drops (
        id INT AUTO_INCREMENT PRIMARY KEY,
        session_id INT NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        authorized_by INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES cash_sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (authorized_by) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    // Crear tabla de gastos si no existe
    await conn.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        description TEXT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        amount_ves DECIMAL(12, 2) NULL,
        currency VARCHAR(10) NOT NULL DEFAULT 'USD',
        expense_type VARCHAR(20) NOT NULL DEFAULT 'unexpected',
        is_active TINYINT NOT NULL DEFAULT 1,
        start_date DATE NULL,
        next_due_date DATE NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    // Crear tabla de proveedores si no existe
    await conn.query(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        contact_name VARCHAR(100) NULL,
        email VARCHAR(100) NULL,
        phone VARCHAR(30) NULL,
        address TEXT NULL,
        rif VARCHAR(50) NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);
    console.log('Tabla "suppliers" verificada.');

    // Insertar configuraciones por defecto si no existen
    await conn.query(`
      INSERT IGNORE INTO settings (settings_key, settings_value) VALUES 
      ('debtor_reminder_frequency_days', '7'),
      ('debtor_reminder_email_template', 'Hola {customerName},\\n\\nTe recordamos amablemente que tienes un saldo pendiente de \${amountPending} de tu compra con factura #{saleId}.\\n\\nPor favor realiza el pago correspondiente lo antes posible para saldar tu cuenta.\\n\\n¡Muchas gracias por tu preferencia!'),
      ('usd_to_ves_rate', '40.00'),
      ('eur_to_ves_rate', '43.50'),
      ('cash_drop_limit', '500.00')
    `);
    console.log('Configuraciones iniciales de tasas, recordatorios y límites de caja verificadas.');

    // Insertar vendedor de prueba si no existe
    const [existingSeller]: any = await conn.query("SELECT id FROM users WHERE email = 'vendedor@sistema.com' LIMIT 1");
    if (existingSeller.length === 0) {
      await conn.query(`
        INSERT INTO users (name, email, password, role, phone) 
        VALUES ('Vendedor', 'vendedor@sistema.com', '$2a$10$vOcp1PI6sKSr3gRv6TMwSOW.SnrMNn.OGN70l8ZTitvT6FkL3TYi.', 'seller', '+584120000000')
      `);
      console.log('Usuario vendedor registrado con éxito (contraseña: vendedor123).');
    }

    console.log('Migraciones completadas exitosamente.');
  } catch (error) {
    console.error('Error al ejecutar migraciones de base de datos:', error);
  } finally {
    conn.release();
  }
}

// Arrancar Servidor
app.listen(PORT, () => {
  console.log(`==========================================================`);
  console.log(`🚀 Servidor backend FacilitoApp corriendo en puerto ${PORT} 🐒`);
  console.log(`🔗 API Health: http://localhost:${PORT}/api/health`);
  console.log(`==========================================================`);
});

// Ejecutar migraciones y cron jobs en segundo plano para no bloquear el primer arranque
void runMigrations()
  .then(() => {
    // Iniciar cron de recordatorio de deudas en segundo plano
    startReminderCron();

    // Iniciar cron de actualización automática de tasas BCV en segundo plano
    startRatesCron();
  })
  .catch((error) => {
    console.error('Error al iniciar migraciones/cron del backend:', error);
  });
