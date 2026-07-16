"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const auth_1 = __importDefault(require("./controllers/auth"));
const products_1 = __importDefault(require("./controllers/products"));
const sales_1 = __importDefault(require("./controllers/sales"));
const stats_1 = __importDefault(require("./controllers/stats"));
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
// Arrancar Servidor
app.listen(PORT, () => {
    console.log(`==========================================================`);
    console.log(`🚀 Servidor backend POS Online corriendo en puerto ${PORT}`);
    console.log(`🔗 API Health: http://localhost:${PORT}/api/health`);
    console.log(`==========================================================`);
});
