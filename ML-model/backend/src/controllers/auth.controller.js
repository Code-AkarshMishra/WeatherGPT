const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');
const ApiError = require('../utils/apiError');
const { sendSuccess } = require('../utils/response');

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
};

class AuthController {
  async register(req, res, next) {
    try {
      const { name, email, password } = req.body;

      const existing = await User.findOne({ email: email.toLowerCase() });
      if (existing) {
        throw ApiError.conflict('An account with this email address already exists');
      }

      const user = await User.create({
        name,
        email: email.toLowerCase(),
        password,
      });

      const token = generateToken(user._id);

      return sendSuccess(
        res,
        {
          user: user.toSafeObject(),
          token,
        },
        { message: 'Registration successful' },
        201
      );
    } catch (error) {
      next(error);
    }
  }

  async login(req, res, next) {
    try {
      const { email, password } = req.body;

      const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
      if (!user) {
        throw ApiError.unauthorized('Invalid email or password');
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        throw ApiError.unauthorized('Invalid email or password');
      }

      const token = generateToken(user._id);

      return sendSuccess(
        res,
        {
          user: user.toSafeObject(),
          token,
        },
        { message: 'Login successful' }
      );
    } catch (error) {
      next(error);
    }
  }

  async getCurrentUser(req, res, next) {
    try {
      return sendSuccess(res, {
        user: req.user.toSafeObject(),
      });
    } catch (error) {
      next(error);
    }
  }

  async logout(req, res, next) {
    try {
      return sendSuccess(res, { message: 'Logged out successfully' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuthController();
