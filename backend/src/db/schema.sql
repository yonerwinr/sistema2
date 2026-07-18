-- Crear la base de datos si no existe
CREATE DATABASE IF NOT EXISTS pos_online_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE pos_online_db;

-- Tabla de Usuarios (Clientes y Administradores)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'customer') DEFAULT 'customer',
    phone VARCHAR(20) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Tabla de Productos
CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    description TEXT NULL,
    price DECIMAL(10, 2) NOT NULL,
    stock INT NOT NULL DEFAULT 0,
    image_url VARCHAR(255) NULL,
    category VARCHAR(100) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Tabla de Ventas (Órdenes)
CREATE TABLE IF NOT EXISTS sales (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    customer_name VARCHAR(100) NULL,
    customer_phone VARCHAR(20) NULL,
    customer_email VARCHAR(100) NULL,
    total DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL DEFAULT 'cash',
    type ENUM('online', 'pos') NOT NULL DEFAULT 'pos',
    status ENUM('pending', 'completed', 'cancelled') NOT NULL DEFAULT 'completed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Tabla de Detalles de la Venta (Productos vendidos)
CREATE TABLE IF NOT EXISTS sale_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sale_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Insertar Usuario Administrador por Defecto
-- Contraseña es 'admin123' (encriptado con bcrypt rounds=10)
INSERT INTO users (name, email, password, role, phone) 
VALUES ('Administrador', 'admin@sistema.com', '$2a$10$l8fs7iw/e3Xm.mIJvFAHsuhA.jfva6FvaNpvSoqOSVxqnRkJo0Ie2', 'admin', '+5491122334455')
ON DUPLICATE KEY UPDATE id=id;

-- Insertar Usuario Vendedor por Defecto
-- Contraseña es 'vendedor123' (encriptado con bcrypt rounds=10)
INSERT INTO users (name, email, password, role, phone) 
VALUES ('Vendedor', 'vendedor@sistema.com', '$2a$10$vOcp1PI6sKSr3gRv6TMwSOW.SnrMNn.OGN70l8ZTitvT6FkL3TYi.', 'seller', '+584120000000')
ON DUPLICATE KEY UPDATE id=id;

-- Insertar Productos de Prueba Iniciales
INSERT INTO products (name, description, price, stock, image_url, category)
VALUES 
('iPhone 15 Pro Max', 'Pantalla Super Retina XDR de 6.7 pulgadas, chip A17 Pro, sistema de camaras pro de 48 MP.', 1199.00, 15, 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?q=80&w=600&auto=format&fit=crop', 'Smartphones'),
('MacBook Air M3', 'Chip M3 de Apple, CPU de 8 nucleos, GPU de 10 nucleos, 8 GB de memoria unificada, 512 GB SSD.', 1099.00, 10, 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?q=80&w=600&auto=format&fit=crop', 'Laptops'),
('Sony WH-1000XM5', 'Auriculares inalambricos con cancelacion de ruido lider del sector, 30 horas de autonomia.', 349.99, 20, 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=600&auto=format&fit=crop', 'Accesorios'),
('iPad Air M2', 'Pantalla Liquid Retina de 11 pulgadas, Chip M2, 128 GB de almacenamiento, Wi-Fi 6E.', 599.00, 8, 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?q=80&w=600&auto=format&fit=crop', 'Tablets'),
('Apple Watch Ultra 2', 'Caja de titanio de 49 mm, hasta 36 horas de bateria, GPS de doble frecuencia de alta precision.', 799.00, 12, 'https://images.unsplash.com/photo-1434494878577-86c23bcb06b9?q=80&w=600&auto=format&fit=crop', 'Smartwatches');
