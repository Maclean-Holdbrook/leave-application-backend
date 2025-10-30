const express = require('express');
const router = express.Router();
const {
  getAllUsers,
  updateUserRole,
  updateLeaveBalance,
  getUserBalance,
  getStatistics
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

// All routes require admin role
router.use(protect);
router.use(authorize('admin'));

router.get('/users', getAllUsers);
router.put('/users/:userId/role', updateUserRole);
router.get('/users/:userId/balance', getUserBalance);
router.put('/users/:userId/balance', updateLeaveBalance);
router.get('/statistics', getStatistics);

module.exports = router;
