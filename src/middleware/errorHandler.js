const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log to console for dev
  console.error(err);

  // PostgreSQL error codes
  if (err.code === '23505') {
    // Unique constraint violation
    const message = 'Duplicate field value entered';
    error = { message, statusCode: 400 };
  }

  if (err.code === '23503') {
    // Foreign key violation
    const message = 'Invalid reference to related resource';
    error = { message, statusCode: 400 };
  }

  if (err.code === '22P02') {
    // Invalid input syntax
    const message = 'Invalid input value';
    error = { message, statusCode: 400 };
  }

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Server Error',
    ...(process.env.NODE_ENV === 'development' && { error: err })
  });
};

module.exports = errorHandler;
