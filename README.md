# Life Hospital Leave Management System - Backend

Backend API for the Life Hospital Leave Management System built with Node.js, Express, and PostgreSQL (Neon).

## Features

- User authentication (JWT)
- Role-based access control (Employee, Manager, Admin)
- Leave request management
- Leave balance tracking
- Manager approval workflow
- PostgreSQL database with Neon

## Prerequisites

- Node.js (v14 or higher)
- Neon PostgreSQL database account
- npm or yarn

## Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the root directory:
```bash
cp .env.example .env
```

3. Update the `.env` file with your configuration:
   - Get your Neon database URL from [https://neon.tech](https://neon.tech)
   - Set a strong JWT_SECRET
   - Configure other environment variables

4. Set up the database:
   - Copy the SQL from `src/config/database.sql`
   - Run it in your Neon SQL Editor or using a PostgreSQL client

## Running the Server

Development mode with auto-reload:
```bash
npm run dev
```

Production mode:
```bash
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Leave Management
- `GET /api/leaves/types` - Get all leave types
- `POST /api/leaves` - Submit leave request
- `GET /api/leaves/my-requests` - Get user's leave requests
- `GET /api/leaves/balance` - Get user's leave balance
- `GET /api/leaves/team-requests` - Get team requests (Manager)
- `PUT /api/leaves/:id/approve` - Approve leave request (Manager)
- `PUT /api/leaves/:id/reject` - Reject leave request (Manager)
- `GET /api/leaves/all` - Get all leave requests (Admin)

## Database Schema

The database includes the following tables:
- `users` - User accounts
- `leave_types` - Types of leave (Annual, Sick, etc.)
- `leave_balances` - Leave balance per user per type
- `leave_requests` - Leave requests with status

## Environment Variables

```
PORT=5000
NODE_ENV=development
DATABASE_URL=your_neon_database_url
JWT_SECRET=your_secret_key
JWT_EXPIRE=7d
CLIENT_URL=http://localhost:5173
```

## Project Structure

```
src/
├── config/
│   ├── database.js          # Database connection
│   └── database.sql         # Database schema
├── controllers/
│   ├── authController.js    # Authentication logic
│   └── leaveController.js   # Leave management logic
├── middleware/
│   ├── auth.js              # JWT authentication
│   └── errorHandler.js      # Error handling
├── routes/
│   ├── authRoutes.js        # Auth routes
│   └── leaveRoutes.js       # Leave routes
├── utils/
│   └── helpers.js           # Helper functions
└── server.js                # Express app setup
```

## Default Leave Types

- Annual Leave: 21 days/year (carry over allowed)
- Sick Leave: 10 days/year
- Maternity Leave: 90 days
- Paternity Leave: 10 days
- Compassionate Leave: 5 days

## Security

- Passwords are hashed using bcrypt
- JWT tokens for authentication
- Role-based access control
- SQL injection prevention with parameterized queries

## Support

For issues and questions, please contact the development team.
