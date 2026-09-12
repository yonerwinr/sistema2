"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const superadminController_1 = require("./superadminController");
const router = (0, express_1.Router)();
// Todas las rutas de SuperAdmin requieren autenticación y rol 'superadmin'
router.use(auth_1.authenticate);
router.use(auth_1.isSuperAdmin);
router.get('/metrics', superadminController_1.getSuperAdminMetrics);
router.get('/businesses', superadminController_1.getBusinessesList);
router.post('/businesses', superadminController_1.createBusiness);
router.put('/businesses/:id/license', superadminController_1.updateBusinessLicense);
exports.default = router;
