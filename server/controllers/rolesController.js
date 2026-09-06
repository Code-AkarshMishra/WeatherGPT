/**
 * rolesController.js
 * GET /api/roles — returns all active roles for the sidebar dropdown.
 */
const Role = require('../models/Role');

exports.getRoles = async (req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    const roles = await Role.find({ isActive: true })
      .sort({ sortOrder: 1 })
      .select('-systemPromptTemplate -__v') // don't expose prompts to client
      .lean();

    res.json({ success: true, data: roles });
  } catch (err) {
    next(err);
  }
};
