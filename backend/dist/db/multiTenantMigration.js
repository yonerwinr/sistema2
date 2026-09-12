"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMultiTenantMigration = runMultiTenantMigration;
/**
 * multiTenantMigration.ts
 * Migración idempotente para transformar la base de datos a Multi-Tenant SaaS.
 * Crea la tabla de negocios y vincula business_id a todas las entidades del sistema.
 */
async function runMultiTenantMigration(conn) {
    console.log('[MULTI-TENANT] Iniciando verificación y migración de base de datos Multi-Tenant...');
    // 1. Crear tabla de Comercios / Negocios (businesses)
    await conn.query(`
    CREATE TABLE IF NOT EXISTS businesses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      slug VARCHAR(100) NOT NULL UNIQUE,
      rif VARCHAR(50) NULL,
      legal_name VARCHAR(150) NULL,
      logo_url VARCHAR(255) NULL,
      phone VARCHAR(50) NULL,
      email VARCHAR(100) NULL,
      address TEXT NULL,
      ticket_message TEXT NULL,
      license_status ENUM('trial', 'active', 'expired', 'suspended') DEFAULT 'trial',
      license_plan ENUM('basic', 'pro', 'enterprise') DEFAULT 'pro',
      license_expires_at DATETIME NULL,
      price_monthly DECIMAL(10, 2) DEFAULT 25.00,
      google_sheet_id VARCHAR(255) NULL,
      google_sheet_url TEXT NULL,
      google_sheets_webhook_url TEXT NULL,
      owner_user_id INT NULL,
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_slug (slug),
      INDEX idx_license_status (license_status)
    ) ENGINE=InnoDB;
  `);
    console.log('[MULTI-TENANT] Tabla "businesses" lista.');
    // 2. Insertar Negocio Principal por defecto para conservar datos existentes
    await conn.query(`
    INSERT INTO businesses (id, name, slug, rif, legal_name, phone, email, address, ticket_message, license_status, license_plan, license_expires_at, is_active)
    VALUES (
      1, 
      'Facilito Principal', 
      'principal', 
      'J-50123456-7', 
      'FacilitoApp C.A.', 
      '+58 412 1234567', 
      'admin@sistema.com', 
      'Av. Francisco de Miranda, Centro Empresarial, Caracas', 
      '¡Gracias por preferirnos! Tan fácil que hasta un monito lo usa 🐒', 
      'active', 
      'enterprise', 
      '2099-12-31 23:59:59', 
      1
    )
    ON DUPLICATE KEY UPDATE id = id;
  `);
    // 3. Tablas que deben tener la columna business_id
    const tenantTables = [
        'users',
        'products',
        'sales',
        'cash_sessions',
        'cash_drops',
        'expenses',
        'suppliers',
        'returns_claims',
        'audit_logs',
        'coupons',
        'settings'
    ];
    for (const table of tenantTables) {
        try {
            const [cols] = await conn.query(`SHOW COLUMNS FROM ${table}`);
            const colNames = cols.map((c) => c.Field);
            if (!colNames.includes('business_id')) {
                await conn.query(`ALTER TABLE ${table} ADD COLUMN business_id INT NOT NULL DEFAULT 1`);
                try {
                    await conn.query(`ALTER TABLE ${table} ADD INDEX idx_business_id (business_id)`);
                }
                catch (_) { }
                console.log(`[MULTI-TENANT] Columna "business_id" agregada a la tabla "${table}".`);
            }
        }
        catch (err) {
            console.warn(`[MULTI-TENANT] Advertencia en tabla "${table}":`, err.message);
        }
    }
    // 4. Asegurar que el rol 'superadmin' exista en el ENUM de roles de users
    try {
        await conn.query(`
      ALTER TABLE users MODIFY COLUMN role ENUM('superadmin', 'admin', 'customer', 'seller', 'billing') DEFAULT 'customer'
    `);
        console.log('[MULTI-TENANT] Rol "superadmin" habilitado en tabla users.');
    }
    catch (err) {
        console.warn('[MULTI-TENANT] Advertencia al actualizar roles en users:', err.message);
    }
    // 5. Crear usuario SuperAdmin por defecto si no existe (superadmin@facilito.com / admin123)
    try {
        const [existingSuper] = await conn.query("SELECT id FROM users WHERE email = 'superadmin@facilito.com' LIMIT 1");
        if (existingSuper.length === 0) {
            await conn.query(`
        INSERT INTO users (name, email, password, role, phone, business_id) 
        VALUES ('SuperAdmin Facilito', 'superadmin@facilito.com', '$2a$10$l8fs7iw/e3Xm.mIJvFAHsuhA.jfva6FvaNpvSoqOSVxqnRkJo0Ie2', 'superadmin', '+584120000000', 1)
      `);
            console.log('[MULTI-TENANT] Usuario SuperAdmin (superadmin@facilito.com) creado exitosamente.');
        }
    }
    catch (err) {
        console.warn('[MULTI-TENANT] Error al crear usuario superadmin:', err.message);
    }
    console.log('[MULTI-TENANT] Migración Multi-Tenant completada con éxito.');
}
