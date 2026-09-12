import { Router } from 'express';
import { authenticate, isSuperAdmin } from '../middleware/auth';
import {
  getSuperAdminMetrics,
  getBusinessesList,
  createBusiness,
  updateBusinessLicense
} from './superadminController';

const router = Router();

// Todas las rutas de SuperAdmin requieren autenticación y rol 'superadmin'
router.use(authenticate as any);
router.use(isSuperAdmin as any);

router.get('/metrics', getSuperAdminMetrics);
router.get('/businesses', getBusinessesList);
router.post('/businesses', createBusiness);
router.put('/businesses/:id/license', updateBusinessLicense);

export default router;
