const express = require('express');
const { body, validationResult } = require('express-validator');

const { protect } = require('../middleware/auth.middleware');
const {
  uploadProfilePic,
  handleUploadError,
} = require('../middleware/upload.middleware');
const {
  registerStart,
  registerVerify,
  verifyOTP,
  completeRegistration,
  login,
  getMe,
  updateProfilePicture,
} = require('../controllers/auth.controller');

const router = express.Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  return next();
};

router.post(
  '/register/start',
  [
    body('firstName').optional().isString().isLength({ max: 50 }),
    body('lastName').optional().isString().isLength({ max: 50 }),
    body('email').isEmail().normalizeEmail(),
    body('phoneNumber').notEmpty(),
    body('password').isLength({ min: 8 }),
    body('role').isIn(['player', 'organizer']),
  ],
  validate,
  registerStart
);

router.post(
  '/register/verify',
  [body('email').isEmail().normalizeEmail(), body('otp').isLength({ min: 4, max: 10 })],
  validate,
  registerVerify
);

router.post(
  '/verify-otp',
  [body('idToken').notEmpty().withMessage('Firebase ID token is required')],
  validate,
  verifyOTP
);

router.post(
  '/complete-registration',
  [
    body('phoneNumber').notEmpty(),
    body('username').isLength({ min: 3, max: 20 }).matches(/^[a-zA-Z0-9_]+$/),
    body('password').isLength({ min: 8 }),
    body('role').isIn(['player', 'organizer']),
  ],
  validate,
  completeRegistration
);

router.post(
  '/login',
  [body('password').notEmpty()],
  validate,
  login
);

router.get('/me', protect, getMe);

router.post(
  '/profile-picture',
  protect,
  uploadProfilePic.single('profilePicture'),
  handleUploadError,
  updateProfilePicture,
);

module.exports = router;

