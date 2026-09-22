const User = require('../models/User');
const ApiError = require('../utils/apiError');
const { sendSuccess } = require('../utils/response');

class UserController {
  async getPreferences(req, res, next) {
    try {
      const user = await User.findById(req.user._id).select('preferences savedLocations');
      if (!user) throw ApiError.notFound('User not found');

      return sendSuccess(res, {
        preferences: user.preferences,
        savedLocations: user.savedLocations,
      });
    } catch (error) {
      next(error);
    }
  }

  async updatePreferences(req, res, next) {
    try {
      const user = await User.findById(req.user._id);
      if (!user) throw ApiError.notFound('User not found');

      if (req.body.language) user.preferences.language = req.body.language;
      if (req.body.units) user.preferences.units = req.body.units;
      if (req.body.advisoryPersona) user.preferences.advisoryPersona = req.body.advisoryPersona;
      if (req.body.voicePreference) user.preferences.voicePreference = req.body.voicePreference;
      if (req.body.notificationPreferences) {
        user.preferences.notificationPreferences = {
          ...user.preferences.notificationPreferences,
          ...req.body.notificationPreferences,
        };
      }

      await user.save();

      return sendSuccess(res, {
        preferences: user.preferences,
      }, { message: 'Preferences updated successfully' });
    } catch (error) {
      next(error);
    }
  }

  async getSavedLocations(req, res, next) {
    try {
      const user = await User.findById(req.user._id).select('savedLocations');
      return sendSuccess(res, {
        savedLocations: user.savedLocations || [],
      });
    } catch (error) {
      next(error);
    }
  }

  async addSavedLocation(req, res, next) {
    try {
      const { name, region, country, lat, lon, isDefault } = req.body;
      const user = await User.findById(req.user._id);

      if (isDefault) {
        user.savedLocations.forEach((loc) => {
          loc.isDefault = false;
        });
      }

      user.savedLocations.push({
        name,
        region,
        country: country || 'India',
        lat,
        lon,
        isDefault: !!isDefault,
      });

      await user.save();

      return sendSuccess(res, {
        savedLocations: user.savedLocations,
      }, { message: 'Location saved successfully' }, 201);
    } catch (error) {
      next(error);
    }
  }

  async removeSavedLocation(req, res, next) {
    try {
      const { locationId } = req.params;
      const user = await User.findById(req.user._id);

      user.savedLocations = user.savedLocations.filter(
        (loc) => loc._id.toString() !== locationId
      );

      await user.save();

      return sendSuccess(res, {
        savedLocations: user.savedLocations,
      }, { message: 'Location removed successfully' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new UserController();
