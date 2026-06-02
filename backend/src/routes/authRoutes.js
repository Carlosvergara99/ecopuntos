// Endpoints de auth. Acá solo decidimos URL + middleware; la lógica está
// en el controller. Un archivo por recurso para que app.js no se infle.

import { Router } from 'express';

import * as authController from '../controllers/authController.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

router.post('/registro', asyncHandler(authController.registro));
router.post('/login',    asyncHandler(authController.login));
router.post('/google',   asyncHandler(authController.googleLogin));
router.get('/yo',        requireAuth, asyncHandler(authController.yo));

export default router;
