// Endpoint rápido para los EcoPuntos que mapeamos en el front. Solo
// lectura por ahora.

import { Router } from 'express';

import * as ecopuntosController from '../controllers/ecopuntosController.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

router.get('/', asyncHandler(ecopuntosController.listar));

export default router;
