import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './controllers/auth';
import productRoutes from './controllers/products';
import saleRoutes from './controllers/sales';
import statsRoutes from './controllers/stats';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());

// Servir imagenes estaticas o assets si es necesario
// app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Rutas de la API
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/stats', statsRoutes);

// Ruta raiz de prueba
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Servidor POS Online funcionando correctamente' });
});

// Arrancar Servidor
app.listen(PORT, () => {
  console.log(`==========================================================`);
  console.log(`🚀 Servidor backend POS Online corriendo en puerto ${PORT}`);
  console.log(`🔗 API Health: http://localhost:${PORT}/api/health`);
  console.log(`==========================================================`);
});
