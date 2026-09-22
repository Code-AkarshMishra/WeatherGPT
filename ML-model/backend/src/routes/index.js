const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const locationRoutes = require('./location.routes');
const weatherRoutes = require('./weather.routes');
const alertRoutes = require('./alert.routes');
const climateRoutes = require('./climate.routes');
const riskRoutes = require('./risk.routes');
const advisoryRoutes = require('./advisory.routes');
const chatRoutes = require('./chat.routes');
const mapRoutes = require('./map.routes');

router.use('/auth', authRoutes);
router.use('/user', userRoutes);
router.use('/location', locationRoutes);
router.use('/weather', weatherRoutes);
router.use('/alerts', alertRoutes);
router.use('/climate', climateRoutes);
router.use('/risk', riskRoutes);
router.use('/advisory', advisoryRoutes);
router.use('/chat', chatRoutes);
router.use('/map', mapRoutes);

module.exports = router;
