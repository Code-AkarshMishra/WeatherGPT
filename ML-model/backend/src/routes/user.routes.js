const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const validate = require('../middleware/validate.middleware');
const { requireAuth } = require('../middleware/auth.middleware');
const { updatePreferencesSchema, savedLocationSchema } = require('../validators/user.validator');

router.use(requireAuth);

router.get('/preferences', userController.getPreferences);
router.put('/preferences', validate(updatePreferencesSchema), userController.updatePreferences);

router.get('/locations', userController.getSavedLocations);
router.post('/locations', validate(savedLocationSchema), userController.addSavedLocation);
router.delete('/locations/:locationId', userController.removeSavedLocation);

module.exports = router;
