const express = require('express');
const router = express.Router();
const {
  submitLeaveRequest,
  getMyLeaveRequests,
  getTeamLeaveRequests,
  approveLeaveRequest,
  rejectLeaveRequest,
  getLeaveBalance,
  getAllLeaveRequests,
  getLeaveTypes
} = require('../controllers/leaveController');
const { protect, authorize } = require('../middleware/auth');

// Leave types (accessible to all authenticated users)
router.get('/types', protect, getLeaveTypes);

// Employee routes
router.post('/', protect, submitLeaveRequest);
router.get('/my-requests', protect, getMyLeaveRequests);
router.get('/balance', protect, getLeaveBalance);

// Manager routes
router.get('/team-requests', protect, authorize('manager', 'admin'), getTeamLeaveRequests);
router.put('/:id/approve', protect, authorize('manager', 'admin'), approveLeaveRequest);
router.put('/:id/reject', protect, authorize('manager', 'admin'), rejectLeaveRequest);

// Admin routes
router.get('/all', protect, authorize('admin'), getAllLeaveRequests);

module.exports = router;
