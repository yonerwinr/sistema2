require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function main() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'pos_online_db',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined
  });

  const conn = await pool.getConnection();

  try {
    console.log('🔄 Conectando a la base de datos...');

    const businessName = 'Victor Salom Ecommerce';
    const slug = 'victor-salom-ecommerce';
    const adminEmail = 'victorsalom@ecommerce.com';
    const adminPasswordRaw = 'admin123';
    const adminName = 'Victor Salom';

    // 1. Verificar si el comercio ya existe
    const [existingBiz] = await conn.query('SELECT * FROM businesses WHERE slug = ? OR name = ?', [slug, businessName]);
    if (existingBiz.length > 0) {
      console.log(`⚠️ El comercio "${businessName}" (slug: ${slug}) ya existe en el sistema con ID #${existingBiz[0].id}.`);
      
      // Actualizar vigencia a 3 días de prueba si se desea
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      expiresAt.setHours(23, 59, 59, 999);

      await conn.query(`
        UPDATE businesses 
        SET license_status = 'trial', license_plan = 'trial_3days', license_expires_at = ?, is_active = 1
        WHERE id = ?
      `, [expiresAt, existingBiz[0].id]);

      console.log(`✅ Comercio actualizado a 3 días de prueba (Vence: ${expiresAt.toISOString()}).`);
      
      const [ownerRows] = await conn.query('SELECT id, email, role FROM users WHERE business_id = ? AND role = "admin"', [existingBiz[0].id]);
      console.log('Admin del comercio:', ownerRows);
      return;
    }

    // 2. Calcular fecha de vencimiento: 3 días de prueba
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    expiresAt.setHours(23, 59, 59, 999);

    await conn.beginTransaction();

    // 3. Crear el comercio
    const [bizResult] = await conn.query(`
      INSERT INTO businesses (
        name, slug, rif, legal_name, phone, email, address, ticket_message,
        license_status, license_plan, license_expires_at, price_monthly,
        google_sheet_id, google_sheet_url, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `, [
      businessName,
      slug,
      'J-00000000-0',
      businessName,
      '+58 412 0000000',
      adminEmail,
      'Venezuela',
      `¡Gracias por su compra en ${businessName}! 🐒`,
      'trial',
      'trial_3days',
      expiresAt,
      0.00,
      null,
      'https://sheets.new'
    ]);

    const businessId = bizResult.insertId;
    console.log(`✅ Comercio creado exitosamente: ID #${businessId}`);

    // 4. Crear o asociar usuario administrador
    const [existingUser] = await conn.query('SELECT id FROM users WHERE LOWER(email) = ?', [adminEmail.toLowerCase()]);
    let adminUserId;

    if (existingUser.length > 0) {
      adminUserId = existingUser[0].id;
      await conn.query('UPDATE users SET business_id = ?, role = "admin" WHERE id = ?', [businessId, adminUserId]);
      console.log(`ℹ️ Usuario existente "${adminEmail}" asignado como admin del comercio.`);
    } else {
      const hashedPassword = await bcrypt.hash(adminPasswordRaw, 10);
      const [userResult] = await conn.query(`
        INSERT INTO users (
          name, email, password, role, phone, business_id, email_verified, phone_verified
        ) VALUES (?, ?, ?, 'admin', ?, ?, 1, 1)
      `, [
        adminName,
        adminEmail,
        hashedPassword,
        '+58 412 0000000',
        businessId
      ]);
      adminUserId = userResult.insertId;
      console.log(`✅ Usuario administrador creado: "${adminEmail}" (ID #${adminUserId})`);
    }

    // 5. Vincular owner_user_id en businesses
    await conn.query('UPDATE businesses SET owner_user_id = ? WHERE id = ?', [adminUserId, businessId]);

    await conn.commit();

    console.log('\n==================================================');
    console.log('🎉 COMERCIO CREADO SATISFACTORIAMENTE');
    console.log('==================================================');
    console.log(`ID:           ${businessId}`);
    console.log(`Nombre:       ${businessName}`);
    console.log(`Slug:         ${slug}`);
    console.log(`Estado:       Prueba (trial)`);
    console.log(`Plan:         trial_3days (3 días de prueba)`);
    console.log(`Vencimiento:  ${expiresAt.toLocaleString('es-ES', { timeZone: 'America/Caracas' })} (${expiresAt.toISOString()})`);
    console.log(`\n🔑 ACCESO ADMINISTRADOR:`);
    console.log(`Email:        ${adminEmail}`);
    console.log(`Contraseña:   ${adminPasswordRaw}`);
    console.log(`\n🌐 ENLACES:`);
    console.log(`Tienda:       /?b=${slug}`);
    console.log(`Panel Admin:  Iniciar sesión con ${adminEmail}`);
    console.log('==================================================\n');

  } catch (error) {
    await conn.rollback();
    console.error('❌ Error creando comercio:', error);
  } finally {
    conn.release();
    await pool.end();
  }
}

main();
