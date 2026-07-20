const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const mysql = require('mysql2/promise');

(async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined
  });

  const categories = ['Electrónicos', 'Hogar', 'Ropa', 'Deportes', 'Juguetes', 'Belleza', 'Herramientas', 'Muebles', 'Mascotas', 'Tecnología'];
  const baseNames = ['Auriculares', 'Teclado', 'Mouse', 'Monitor', 'Laptop', 'Celular', 'Tablet', 'Cámara', 'Impresora', 'Smartwatch', 'Parlante', 'Router', 'Cargador', 'Silla', 'Mesa'];

  await connection.execute('START TRANSACTION');

  for (let i = 1; i <= 1000; i += 1) {
    const code = `PRD-${String(i).padStart(6, '0')}`;
    const name = `${baseNames[(i - 1) % baseNames.length]} ${String(i).padStart(4, '0')}`;
    const category = categories[(i - 1) % categories.length];
    const description = `Producto ${i} de ${category.toLowerCase()} con alta calidad y garantía.`;
    const price = Number((Math.floor(Math.random() * 9000) + 100) / 100).toFixed(2);
    const stock = Math.floor(Math.random() * 151);
    const image_url = `https://picsum.photos/seed/${code}/600/400`;

    await connection.execute(
      'INSERT INTO products (name, description, price, stock, image_url, category) VALUES (?, ?, ?, ?, ?, ?)',
      [name, description, price, stock, image_url, category]
    );
  }

  await connection.execute('COMMIT');
  const [rows] = await connection.execute('SELECT COUNT(*) AS total FROM products');
  console.log(JSON.stringify({ inserted: 1000, total: rows[0].total }));
  await connection.end();
})().catch(async (err) => {
  console.error(err);
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined
    });
    await connection.execute('ROLLBACK');
    await connection.end();
  } catch (_) {}
  process.exit(1);
});
