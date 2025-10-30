const pool = require('../config/database');
const { calculateWorkingDays } = require('../utils/helpers');

// @desc    Submit leave request
// @route   POST /api/leaves
// @access  Private
exports.submitLeaveRequest = async (req, res, next) => {
  try {
    const { leave_type_id, start_date, end_date, reason } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!leave_type_id || !start_date || !end_date || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    // Validate dates
    if (new Date(end_date) < new Date(start_date)) {
      return res.status(400).json({
        success: false,
        message: 'End date must be after start date'
      });
    }

    // Calculate working days
    const workingDays = calculateWorkingDays(start_date, end_date);

    // Check leave balance
    const currentYear = new Date().getFullYear();
    const balanceResult = await pool.query(
      'SELECT remaining_days FROM leave_balances WHERE user_id = $1 AND leave_type_id = $2 AND year = $3',
      [userId, leave_type_id, currentYear]
    );

    if (balanceResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No leave balance found for this leave type'
      });
    }

    const remainingDays = balanceResult.rows[0].remaining_days;

    if (workingDays > remainingDays) {
      return res.status(400).json({
        success: false,
        message: `Insufficient leave balance. You have ${remainingDays} days remaining`
      });
    }

    // Get user's manager
    const userResult = await pool.query(
      'SELECT manager_id FROM users WHERE id = $1',
      [userId]
    );

    const managerId = userResult.rows[0]?.manager_id;

    // Create leave request
    const result = await pool.query(
      `INSERT INTO leave_requests (user_id, leave_type_id, start_date, end_date, working_days, reason, manager_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending') RETURNING *`,
      [userId, leave_type_id, start_date, end_date, workingDays, reason, managerId]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user's leave requests
// @route   GET /api/leaves/my-requests
// @access  Private
exports.getMyLeaveRequests = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT lr.*, lt.name as leave_type_name,
              u.name as user_name, u.department,
              m.name as manager_name
       FROM leave_requests lr
       JOIN leave_types lt ON lr.leave_type_id = lt.id
       JOIN users u ON lr.user_id = u.id
       LEFT JOIN users m ON lr.manager_id = m.id
       WHERE lr.user_id = $1
       ORDER BY lr.created_at DESC`,
      [req.user.id]
    );

    res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get team leave requests (for managers)
// @route   GET /api/leaves/team-requests
// @access  Private (Manager)
exports.getTeamLeaveRequests = async (req, res, next) => {
  try {
    const { status } = req.query;

    let query = `
      SELECT lr.*, lt.name as leave_type_name,
             u.name as user_name, u.department,
             m.name as manager_name
      FROM leave_requests lr
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      JOIN users u ON lr.user_id = u.id
      LEFT JOIN users m ON lr.manager_id = m.id
      WHERE lr.manager_id = $1
    `;

    const params = [req.user.id];

    if (status) {
      query += ' AND lr.status = $2';
      params.push(status);
    }

    query += ' ORDER BY lr.created_at DESC';

    const result = await pool.query(query, params);

    res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Approve leave request
// @route   PUT /api/leaves/:id/approve
// @access  Private (Manager/Admin)
exports.approveLeaveRequest = async (req, res, next) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    await client.query('BEGIN');

    // Get leave request details
    // Admins can approve any request, managers can only approve their team's requests
    let query, params;
    if (userRole === 'admin') {
      query = 'SELECT * FROM leave_requests WHERE id = $1 AND status = $2';
      params = [id, 'pending'];
    } else {
      query = 'SELECT * FROM leave_requests WHERE id = $1 AND manager_id = $2 AND status = $3';
      params = [id, userId, 'pending'];
    }

    const requestResult = await client.query(query, params);

    if (requestResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Leave request not found or already processed'
      });
    }

    const leaveRequest = requestResult.rows[0];

    // Update leave request status
    await client.query(
      `UPDATE leave_requests
       SET status = 'approved', approved_by = $1, approved_date = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [userId, id]
    );

    // Update leave balance
    const currentYear = new Date().getFullYear();
    await client.query(
      `UPDATE leave_balances
       SET used_days = used_days + $1, remaining_days = remaining_days - $1
       WHERE user_id = $2 AND leave_type_id = $3 AND year = $4`,
      [leaveRequest.working_days, leaveRequest.user_id, leaveRequest.leave_type_id, currentYear]
    );

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: 'Leave request approved successfully'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

// @desc    Reject leave request
// @route   PUT /api/leaves/:id/reject
// @access  Private (Manager/Admin)
exports.rejectLeaveRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rejection_reason } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!rejection_reason) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a rejection reason'
      });
    }

    // Check if leave request exists
    // Admins can reject any request, managers can only reject their team's requests
    let query, params;
    if (userRole === 'admin') {
      query = 'SELECT id FROM leave_requests WHERE id = $1 AND status = $2';
      params = [id, 'pending'];
    } else {
      query = 'SELECT id FROM leave_requests WHERE id = $1 AND manager_id = $2 AND status = $3';
      params = [id, userId, 'pending'];
    }

    const checkResult = await pool.query(query, params);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found or already processed'
      });
    }

    // Update leave request status
    await pool.query(
      `UPDATE leave_requests
       SET status = 'rejected', rejected_by = $1, rejected_date = CURRENT_TIMESTAMP, rejection_reason = $2
       WHERE id = $3`,
      [userId, rejection_reason, id]
    );

    res.status(200).json({
      success: true,
      message: 'Leave request rejected successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get leave balance for user
// @route   GET /api/leaves/balance
// @access  Private
exports.getLeaveBalance = async (req, res, next) => {
  try {
    const currentYear = new Date().getFullYear();
    const result = await pool.query(
      `SELECT lb.*, lt.name as leave_type_name
       FROM leave_balances lb
       JOIN leave_types lt ON lb.leave_type_id = lt.id
       WHERE lb.user_id = $1 AND lb.year = $2`,
      [req.user.id, currentYear]
    );

    res.status(200).json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all leave requests (Admin only)
// @route   GET /api/leaves/all
// @access  Private (Admin)
exports.getAllLeaveRequests = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT lr.*, lt.name as leave_type_name,
              u.name as user_name, u.department,
              m.name as manager_name
       FROM leave_requests lr
       JOIN leave_types lt ON lr.leave_type_id = lt.id
       JOIN users u ON lr.user_id = u.id
       LEFT JOIN users m ON lr.manager_id = m.id
       ORDER BY lr.created_at DESC`
    );

    res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get leave types
// @route   GET /api/leaves/types
// @access  Private
exports.getLeaveTypes = async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM leave_types ORDER BY name');

    res.status(200).json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
};
