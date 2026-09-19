import { Router } from 'express';
import { uploadsController } from './uploads.controller';

const router = Router();

router.post('/presign', uploadsController.presign.bind(uploadsController));

export const uploadsRoutes = router;
