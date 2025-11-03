const pool = require('../config/database');
const bcrypt = require('bcryptjs');

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Private/Admin
exports.getAllUsers = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, role, department, manager_id, created_at
       FROM users
       ORDER BY created_at DESC`
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

// @desc    Update user role
// @route   PUT /api/admin/users/:userId/role
// @access  Private/Admin
exports.updateUserRole = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    // Validate role
    const validRoles = ['employee', 'manager', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be employee, manager, or admin'
      });
    }

    // Update user role
    const result = await pool.query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, name, email, role, department',
      [role, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user leave balance
// @route   PUT /api/admin/users/:userId/balance
// @access  Private/Admin
exports.updateLeaveBalance = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { leave_type_id, total_days, used_days, remaining_days } = req.body;

    // Validate input
    if (!leave_type_id) {
      return res.status(400).json({
        success: false,
        message: 'Leave type ID is required'
      });
    }

    const currentYear = new Date().getFullYear();

    // Check if balance record exists
    const existingBalance = await pool.query(
      'SELECT id FROM leave_balances WHERE user_id = $1 AND leave_type_id = $2 AND year = $3',
      [userId, leave_type_id, currentYear]
    );

    let result;

    if (existingBalance.rows.length > 0) {
      // Update existing balance
      result = await pool.query(
        `UPDATE leave_balances
         SET total_days = $1,
             used_days = $2,
             remaining_days = $3
         WHERE user_id = $4 AND leave_type_id = $5 AND year = $6
         RETURNING *`,
        [total_days, used_days, remaining_days, userId, leave_type_id, currentYear]
      );
    } else {
      // Create new balance record
      result = await pool.query(
        `INSERT INTO leave_balances (user_id, leave_type_id, total_days, used_days, remaining_days, year)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [userId, leave_type_id, total_days, used_days, remaining_days, currentYear]
      );
    }

    res.status(200).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user leave balance
// @route   GET /api/admin/users/:userId/balance
// @access  Private/Admin
exports.getUserBalance = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const currentYear = new Date().getFullYear();

    const result = await pool.query(
      `SELECT lb.*, lt.name as leave_type_name
       FROM leave_balances lb
       JOIN leave_types lt ON lb.leave_type_id = lt.id
       WHERE lb.user_id = $1 AND lb.year = $2
       ORDER BY lt.name`,
      [userId, currentYear]
    );

    res.status(200).json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get admin statistics
// @route   GET /api/admin/statistics
// @access  Private/Admin
exports.getStatistics = async (req, res, next) => {
  try {
    // Get total users count by role
    const usersCount = await pool.query(
      `SELECT
        COUNT(*) FILTER (WHERE role = 'employee') as employees,
        COUNT(*) FILTER (WHERE role = 'manager') as managers,
        COUNT(*) FILTER (WHERE role = 'admin') as admins,
        COUNT(*) as total
       FROM users`
    );

    // Get leave requests statistics
    const requestsStats = await pool.query(
      `SELECT
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'approved') as approved,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
        COUNT(*) as total
       FROM leave_requests`
    );

    // Get departments count
    const departmentsCount = await pool.query(
      `SELECT COUNT(DISTINCT department) as count FROM users WHERE department IS NOT NULL`
    );

    res.status(200).json({
      success: true,
      data: {
        users: usersCount.rows[0],
        requests: requestsStats.rows[0],
        departments: parseInt(departmentsCount.rows[0].count)
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create staff account
// @route   POST /api/admin/users
// @access  Private/Admin
exports.createStaffAccount = async (req, res, next) => {
  try {
    const { name, email, password, role, department } = req.body;

    // Validate input
    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, password, and role'
      });
    }

    // Validate role
    const validRoles = ['employee', 'manager', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be employee, manager, or admin'
      });
    }

    // Check if user exists
    const userExists = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (userExists.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const result = await pool.query(
      'INSERT INTO users (name, email, password, role, department) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role, department, created_at',
      [name, email, hashedPassword, role, department]
    );

    const user = result.rows[0];

    // Initialize leave balances for new user
    const currentYear = new Date().getFullYear();
    const leaveTypes = await pool.query('SELECT id, days_per_year FROM leave_types');

    for (const leaveType of leaveTypes.rows) {
      await pool.query(
        'INSERT INTO leave_balances (user_id, leave_type_id, total_days, used_days, remaining_days, year) VALUES ($1, $2, $3, $4, $5, $6)',
        [user.id, leaveType.id, leaveType.days_per_year, 0, leaveType.days_per_year, currentYear]
      );
    }

    res.status(201).json({
      success: true,
      message: 'Staff account created successfully',
      data: user
    });
  } catch (error) {
    next(error);
  }
};
