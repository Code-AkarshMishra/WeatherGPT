/**
 * inMemoryAuth.js
 * High-performance in-memory user repository fallback when MongoDB Atlas is offline.
 * Enables zero-downtime development and testing without hanging on Mongoose buffering.
 */
const bcrypt = require('bcryptjs');

class InMemoryAuthStore {
  constructor() {
    this.usersByEmail = new Map();
    this.usersById = new Map();
  }

  async findByEmail(email) {
    if (!email) return null;
    return this.usersByEmail.get(email.toLowerCase().trim()) || null;
  }

  async findById(id) {
    if (!id) return null;
    return this.usersById.get(id) || null;
  }

  async createUser({ name, email, password, defaultRole = 'citizen', preferredLanguage = 'en' }) {
    const cleanEmail = email.toLowerCase().trim();
    if (this.usersByEmail.has(cleanEmail)) {
      throw new Error('User already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const id = 'mem_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

    const user = {
      _id: id,
      name: name.trim(),
      email: cleanEmail,
      password: hashedPassword,
      defaultRole,
      preferredLanguage,
      refreshTokens: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      async comparePassword(candidate) {
        return bcrypt.compare(candidate, this.password);
      },
      toJSON() {
        const copy = { ...this };
        delete copy.password;
        delete copy.refreshTokens;
        delete copy.comparePassword;
        delete copy.toJSON;
        return copy;
      },
    };

    this.usersByEmail.set(cleanEmail, user);
    this.usersById.set(id, user);
    return user;
  }

  async comparePassword(user, candidatePassword) {
    if (!user || !user.password) return false;
    return bcrypt.compare(candidatePassword, user.password);
  }
}

module.exports = new InMemoryAuthStore();
