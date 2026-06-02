// Rutas de solicitudes — todas protegidas.
// Ojo: el `router.use(requireAuth)` aplica a TODAS las rutas de abajo;
// no hace falta poner el middleware en cada una.

import { Router } from 'express';

import * as solicitudesController from '../controllers/solicitudesController.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

router.use(requireAuth);

router.post('/',    asyncHandler(solicitudesController.crear));
router.get('/mias', asyncHandler(solicitudesController.listarMias));
router.patch('/:id/cancelar', asyncHandler(solicitudesController.cancelar));
router.delete('/:id',         asyncHandler(solicitudesController.eliminar));

export default router;
