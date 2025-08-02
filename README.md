# Learning Platform - Project Overview

## Introduction
 Learning is a comprehensive learning management system built with NestJS and PostgreSQL. The platform provides assessment capabilities, coding practice environments, and course management features for educational institutions.

## System Architecture

### Servers
1. **Application Server (NestJS)**
   - Handles API requests and business logic
   - Manages user authentication and authorization
   - Processes assessment submissions and grading
   - Runs on port 3000 by default

2. **Database Server (PostgreSQL)**
   - Stores all application data including users, courses, assessments
   - Manages relationships between entities
   - Handles transactions for data integrity

3. **Code Execution Server**
   - Executes student code submissions in isolated environments
   - Supports multiple programming languages
   - Provides real-time feedback on code execution

## Getting Started

### Prerequisites
- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)
- Docker (for code execution environment)

### Installation Steps

1. **Clone the Repository**
   ```bash
   git clone https://github.com/your-org/mms-learning.git
   cd mms-learning
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Set Up Environment Variables**
   - Copy `.env.example` to `.env`
   - Configure database connection details
   - Set up authentication keys
   - Configure code execution server URL

4. **Database Setup**
   ```bash
   npm run migration:import
   npm run migration:generate
   npm run migration:push
   ```

5. **Start the Application**
   ```bash
   npm run dev
   ```

## Project Structure

```
mms-learning/
├── src/
│   ├── controller/         # API endpoints and controllers
│   ├── service/            # Business logic implementation
│   ├── helpers/            # Utility functions
│   ├── schedule/           # Scheduled tasks and cron jobs
│   └── app.module.ts       # Main application module
├── drizzle/                # Database schema and migrations
├── test/                   # Test files
└── package.json            # Project dependencies and scripts
```

## Key Features

### 1. Assessment Management
- Create and manage various types of assessments
- Support for coding challenges, quizzes, and open-ended questions
- Automated grading for coding questions
- Tracking of student progress and performance

### 2. Code Execution
- Secure code execution environment using Docker
- Support for multiple programming languages
- Real-time feedback on code execution
- Code plagiarism detection

### 3. User Management
- Student and instructor roles with different permissions
- Progress tracking and analytics
- User authentication and authorization

### 4. Content Management
- Course creation and organization
- Module and chapter management
- Resource sharing and distribution

## API Documentation
API documentation is available at `/api-docs` when the server is running. It provides detailed information about all available endpoints, request/response formats, and authentication requirements.

## Development Workflow

### Branch Management
- Create feature branches from `develop`
- Use pull requests for code review
- Merge to `develop` after approval

### Testing
```bash
npm run test          # Run unit tests
npm run test:e2e      # Run end-to-end tests
npm run test:cov      # Generate test coverage report
```

### Deployment
- Automated deployment via CI/CD pipeline
- Staging environment for testing
- Production environment for live application

## Troubleshooting

### Common Issues
1. **Database Connection Issues**
   - Check database credentials in `.env`
   - Verify PostgreSQL service is running
   - Check network connectivity

2. **Code Execution Failures**
   - Verify Docker is running
   - Check code execution server logs
   - Verify language support is enabled

3. **Authentication Problems**
   - Check JWT secret in environment variables
   - Verify token expiration settings
   - Check user permissions

## Support
For technical support or questions, please contact the development team or raise an issue in the repository.

## License
This project is licensed under the MIT License - see the LICENSE file for details. 
