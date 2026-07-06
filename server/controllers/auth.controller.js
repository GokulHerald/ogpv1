const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const User = require('../models/User');
const Wallet = require('../models/Wallet');
const EmailOtp = require('../models/EmailOtp');
const { verifyFirebaseToken } = require('../config/firebase');
const { cloudinary } = require('../config/cloudinary');
const { sendOtpEmail } = require('../utils/email');
const { normalizeNepalPhone, phoneLookupVariants, looksLikeEmail } = require('../utils/phone.utils');

function publicIdFromCloudinaryUrl(url) {
  if (!url || typeof url !== 'string' || !url.trim()) return null;
  const uploadIdx = url.indexOf('/upload/');
  if (uploadIdx === -1) return null;
  const rest = url.slice(uploadIdx + '/upload/'.length);
  const parts = rest.split('/');
  let start = 0;
  while (start < parts.length && parts[start].includes(',')) {
    start += 1;
  }
  if (start < parts.length && /^v\d+$/.test(parts[start])) {
    start += 1;
  }
  const pathPart = parts.slice(start).join('/');
  if (!pathPart) return null;
  return pathPart.replace(/\.[^/.]+$/, '') || null;
}

function generateToken(userId) {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function hashOtp(email, otp) {
  const secret = process.env.OTP_SECRET || process.env.JWT_SECRET || 'ogp-otp';
  return crypto
    .createHmac('sha256', secret)
    .update(`${normalizeEmail(email)}:${String(otp).trim()}`)
    .digest('hex');
}

function generateNumericOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

async function registerStart(req, res) {
  try {
    const firstName = String(req.body.firstName || '').trim();
    const lastName = String(req.body.lastName || '').trim();
    const email = normalizeEmail(req.body.email);
    const phoneRaw = typeof req.body.phoneNumber === 'string' ? req.body.phoneNumber.trim() : '';
    const phoneNumber = normalizeNepalPhone(phoneRaw) || phoneRaw;
    const { password, role } = req.body;

    if (!email) return res.status(400).json({ message: 'Email required' });
    if (!phoneNumber) return res.status(400).json({ message: 'Phone number required' });
    if (!password) return res.status(400).json({ message: 'Password required' });
    if (!['player', 'organizer'].includes(role)) {
      return res.status(400).json({ message: 'Role must be player or organizer' });
    }

    const passwordRegex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(password || '')) {
      return res.status(400).json({
        message: 'Password must be at least 8 characters and include 1 uppercase letter and 1 number',
      });
    }

    const existingByEmail = await User.findOne({ email });
    if (existingByEmail && existingByEmail.isVerified) {
      return res.status(400).json({ message: 'Email is already registered. Please login.' });
    }

    const existingByPhone = await User.findOne({
      phoneNumber: { $in: phoneLookupVariants(phoneRaw) },
    });
    if (existingByPhone && existingByPhone.isVerified) {
      return res.status(400).json({ message: 'Phone number is already registered. Please login.' });
    }

    // Upsert a pending user record so we can attach payment/phone later.
    const user =
      existingByEmail ||
      existingByPhone ||
      (await User.create({
        firstName,
        lastName,
        email,
        phoneNumber,
        password,
        role,
        isVerified: false,
        emailVerified: false,
      }));

    // If user exists but pending, update submitted fields.
    user.firstName = firstName;
    user.lastName = lastName;
    user.email = email;
    user.phoneNumber = phoneNumber;
    user.password = password;
    user.role = role;
    await user.save();

    const otp = generateNumericOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Rate limit: do not send more than once every 30 seconds per email.
    const existingOtp = await EmailOtp.findOne({ email });
    if (existingOtp && existingOtp.lastSentAt && Date.now() - existingOtp.lastSentAt.getTime() < 30_000) {
      return res.status(429).json({ message: 'Please wait before requesting another code' });
    }

    await EmailOtp.findOneAndUpdate(
      { email },
      {
        email,
        otpHash: hashOtp(email, otp),
        expiresAt,
        attempts: 0,
        lastSentAt: new Date(),
        metadata: { userId: String(user._id) },
      },
      { upsert: true, new: true }
    );

    await sendOtpEmail({ to: email, otp, firstName });

    return res.status(200).json({
      message: 'Verification code sent to email',
      email,
      expiresInSeconds: 600,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to start registration' });
  }
}

async function registerVerify(req, res) {
  try {
    const email = normalizeEmail(req.body.email);
    const otp = String(req.body.otp || '').trim();
    if (!email) return res.status(400).json({ message: 'Email required' });
    if (!otp) return res.status(400).json({ message: 'OTP required' });

    const row = await EmailOtp.findOne({ email });
    if (!row) return res.status(400).json({ message: 'No OTP request found. Please request a new code.' });
    if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
      await EmailOtp.deleteOne({ _id: row._id });
      return res.status(400).json({ message: 'OTP expired. Please request a new code.' });
    }

    if ((row.attempts || 0) >= 5) {
      return res.status(429).json({ message: 'Too many attempts. Please request a new code.' });
    }

    const expected = row.otpHash;
    const actual = hashOtp(email, otp);
    if (expected !== actual) {
      row.attempts = Number(row.attempts || 0) + 1;
      await row.save();
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found for this email' });
    }

    user.emailVerified = true;
    user.isVerified = true;
    const savedUser = await user.save();

    // Create wallet if needed (idempotent-ish)
    try {
      const exists = await Wallet.findOne({ user: savedUser._id });
      if (!exists) await Wallet.create({ user: savedUser._id });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to create wallet for user', savedUser._id, e);
    }

    await EmailOtp.deleteOne({ _id: row._id });

    const token = generateToken(savedUser._id);
    return res.status(200).json({ token, user: savedUser.toPublicJSON() });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'OTP verification failed' });
  }
}

async function verifyOTP(req, res) {
  try {
    const { idToken } = req.body;

    const decoded = await verifyFirebaseToken(idToken);
    const phoneNumber = normalizeNepalPhone(decoded.phone_number) || decoded.phone_number;

    let user = await User.findOne({
      phoneNumber: { $in: phoneLookupVariants(decoded.phone_number) },
    });

    if (user && user.isVerified) {
      return res.status(200).json({
        status: 'existing_user',
        message: 'User already registered, please login',
      });
    }

    if (user && !user.isVerified) {
      user.isVerified = true;
      await user.save();
      return res.status(200).json({
        status: 'verified',
        phoneNumber,
      });
    }

    await User.create({
      phoneNumber,
      isVerified: true,
    });

    return res.status(200).json({
      status: 'new_user',
      phoneNumber,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'OTP verification failed' });
  }
}

async function completeRegistration(req, res) {
  try {
    const { phoneNumber, username, password, role } = req.body;

    const user = await User.findOne({ phoneNumber, isVerified: true });
    if (!user) {
      return res.status(404).json({ message: 'Phone number not verified' });
    }

    if (user.username) {
      return res.status(400).json({ message: 'Registration already complete' });
    }

    const usernameRegex = /^[A-Za-z0-9_]{3,20}$/;
    if (!usernameRegex.test(username || '')) {
      return res.status(400).json({
        message: 'Username must be 3-20 characters and contain only letters, numbers, or underscores',
      });
    }

    const passwordRegex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(password || '')) {
      return res.status(400).json({
        message: 'Password must be at least 8 characters and include 1 uppercase letter and 1 number',
      });
    }

    if (!['player', 'organizer'].includes(role)) {
      return res.status(400).json({ message: 'Role must be player or organizer' });
    }

    user.username = username;
    user.password = password;
    user.role = role;

    const savedUser = await user.save();

    // Automatically create a wallet for every newly registered user.
    try {
      await Wallet.create({ user: savedUser._id });
    } catch (e) {
      // Wallet creation failure should not block auth; log for later inspection.
      // eslint-disable-next-line no-console
      console.error('Failed to create wallet for user', savedUser._id, e);
    }

    const token = generateToken(savedUser._id);
    return res.status(200).json({
      token,
      user: savedUser.toPublicJSON(),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Registration failed' });
  }
}

async function login(req, res) {
  try {
    const rawIdentifier = typeof req.body.phoneNumber === 'string'
      ? req.body.phoneNumber.trim()
      : typeof req.body.email === 'string'
        ? normalizeEmail(req.body.email)
        : '';
    const { password } = req.body;

    if (!rawIdentifier) {
      return res.status(400).json({ message: 'Phone number or email required' });
    }

    let user;
    if (looksLikeEmail(rawIdentifier)) {
      user = await User.findOne({ email: normalizeEmail(rawIdentifier) }).select('+password');
    } else {
      const phoneVariants = phoneLookupVariants(rawIdentifier);
      user = await User.findOne({ phoneNumber: { $in: phoneVariants } }).select('+password');
    }
    if (!user) {
      return res.status(404).json({ message: 'No account found with this phone/email' });
    }

    if (!user.isVerified) {
      return res.status(400).json({ message: 'Please verify your account first' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Incorrect password' });
    }

    const token = generateToken(user._id);
    return res.status(200).json({
      token,
      user: user.toPublicJSON(),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Login failed' });
  }
}

async function getMe(req, res) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json({
      user: user.toPublicJSON(),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to fetch profile' });
  }
}

async function updateProfilePicture(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Please upload an image' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const previous = user.profilePicture;
    if (previous && previous !== '') {
      const publicId = publicIdFromCloudinaryUrl(previous);
      if (publicId) {
        try {
          await cloudinary.uploader.destroy(publicId);
        } catch {
          // Old asset may already be gone; still save the new picture
        }
      }
    }

    user.profilePicture = req.file.path;
    await user.save();

    return res.status(200).json({
      message: 'Profile picture updated',
      profilePicture: req.file.path,
      user: user.toPublicJSON(),
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: error.message || 'Failed to update profile picture' });
  }
}

module.exports = {
  registerStart,
  registerVerify,
  verifyOTP,
  completeRegistration,
  login,
  getMe,
  updateProfilePicture,
};

