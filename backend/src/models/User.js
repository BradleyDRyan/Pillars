const { firestore, auth } = require('../config/firebase');
const admin = require('firebase-admin');

/**
 * User — Represents a user in the system
 * 
 * Users can be:
 * - Firebase Auth users (with email/phone)
 * - SMS-only users (created from inbound SMS, stored in Firestore)
 */
class User {
  constructor(data = {}) {
    this.id = data.id || null;
    this.uid = data.uid || data.id || null; // Alias for compatibility
    this.phone = data.phone || null;
    this.email = data.email || null;
    this.displayName = data.displayName || null;
    this.photoURL = data.photoURL || null;
    this.source = data.source || 'app'; // 'app', 'sms', 'admin'
    this.createdAt = data.createdAt || admin.firestore.Timestamp.now();
    this.updatedAt = data.updatedAt || admin.firestore.Timestamp.now();
    this.metadata = data.metadata || {};
  }

  static collection() {
    return firestore.collection('users');
  }

  /**
   * Find a user by phone number
   * First checks Firebase Auth, then Firestore users collection
   * @param {string} phone - Phone number in E.164 format
   * @returns {Promise<User|null>}
   */
  static async findByPhone(phone) {
    if (!phone) return null;
    
    // Normalize phone number
    const normalizedPhone = phone.startsWith('+') ? phone : `+${phone}`;
    
    // First, try Firebase Auth
    try {
      const authUser = await auth.getUserByPhoneNumber(normalizedPhone);
      if (authUser) {
        console.log(`📱 [User] Found Firebase Auth user by phone: ${authUser.uid}`);
        return new User({
          id: authUser.uid,
          uid: authUser.uid,
          phone: authUser.phoneNumber,
          email: authUser.email,
          displayName: authUser.displayName,
          photoURL: authUser.photoURL,
          source: 'app'
        });
      }
    } catch (error) {
      // User not found in Auth, continue to Firestore
      if (error.code !== 'auth/user-not-found') {
        console.error(`[User] Error checking Auth for phone:`, error.message);
      }
    }
    
    // Then, check Firestore users collection
    const snapshot = await this.collection()
      .where('phone', '==', normalizedPhone)
      .limit(1)
      .get();
    
    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      console.log(`📱 [User] Found Firestore user by phone: ${doc.id}`);
      return new User({ id: doc.id, ...doc.data() });
    }
    
    console.log(`📱 [User] No user found for phone: ${normalizedPhone}`);
    return null;
  }

  /**
   * Find a user by ID
   * @param {string} id - User ID
   * @returns {Promise<User|null>}
   */
  static async findById(id) {
    if (!id) return null;
    
    // Try Firestore first
    const doc = await this.collection().doc(id).get();
    if (doc.exists) {
      return new User({ id: doc.id, ...doc.data() });
    }
    
    // Try Firebase Auth
    try {
      const authUser = await auth.getUser(id);
      if (authUser) {
        return new User({
          id: authUser.uid,
          uid: authUser.uid,
          phone: authUser.phoneNumber,
          email: authUser.email,
          displayName: authUser.displayName,
          photoURL: authUser.photoURL,
          source: 'app'
        });
      }
    } catch (error) {
      // User not found
    }
    
    return null;
  }

  /**
   * Create a new user from a phone number (for SMS users)
   * @param {string} phone - Phone number in E.164 format
   * @returns {Promise<User>}
   */
  static async createFromPhone(phone) {
    const normalizedPhone = phone.startsWith('+') ? phone : `+${phone}`;
    
    const userData = {
      phone: normalizedPhone,
      source: 'sms',
      displayName: null,
      email: null,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
      metadata: {
        createdVia: 'sms',
        firstContactAt: new Date().toISOString()
      }
    };
    
    const docRef = await this.collection().add(userData);
    console.log(`📱 [User] Created SMS user: ${docRef.id} for phone: ${normalizedPhone}`);
    
    return new User({ id: docRef.id, ...userData });
  }

  /**
   * Find or create a user by phone number
   * @param {string} phone - Phone number in E.164 format
   * @returns {Promise<User>}
   */
  static async findOrCreateByPhone(phone) {
    const existing = await this.findByPhone(phone);
    if (existing) {
      return existing;
    }
    
    return this.createFromPhone(phone);
  }

  /**
   * Save user data to Firestore
   */
  async save() {
    this.updatedAt = admin.firestore.Timestamp.now();
    
    const data = {
      phone: this.phone,
      email: this.email,
      displayName: this.displayName,
      photoURL: this.photoURL,
      source: this.source,
      updatedAt: this.updatedAt,
      metadata: this.metadata
    };
    
    if (this.id) {
      await User.collection().doc(this.id).set(data, { merge: true });
    } else {
      data.createdAt = this.createdAt;
      const docRef = await User.collection().add(data);
      this.id = docRef.id;
    }
    
    return this;
  }

  toJSON() {
    return {
      id: this.id,
      uid: this.uid || this.id,
      phone: this.phone,
      email: this.email,
      displayName: this.displayName,
      photoURL: this.photoURL,
      source: this.source,
      createdAt: this.createdAt?.toDate ? this.createdAt.toDate().toISOString() : this.createdAt,
      updatedAt: this.updatedAt?.toDate ? this.updatedAt.toDate().toISOString() : this.updatedAt,
      metadata: this.metadata
    };
  }
}

module.exports = User;
