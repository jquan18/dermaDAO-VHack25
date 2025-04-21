# Charity Admin Pages

## 1. Dashboard

### Purpose
Central hub for charity administrators to monitor overall performance and access key functionality.

### Components
- **Performance Summary**
  - Total donations received
  - Number of active projects
  - Current verification score
  - Upcoming withdrawal deadlines
- **Quick Action Buttons**
  - Create New Project
  - Submit Withdrawal Proposal
  - Register Bank Account
- **Recent Activity Feed**
  - Latest donations
  - Recent withdrawal approvals
  - Proposal status updates
- **Funding Overview**
  - Direct donation totals
  - Quadratic funding match estimates
  - Funding by project chart

### API Endpoints
- `GET /api/charities/:id` - Retrieve charity details
- `GET /api/donations/project/:id` - Get donation history
- `GET /api/proposals/project/:id` - List withdrawal proposals

## 2. Charity Profile Management

### Purpose
Allow charity administrators to maintain and update their organization's information.

### Components
- **Charity Information Form**
  - Name
  - Description
  - Website
  - Registration number
  - Country
  - Supporting documentation upload
- **Verification Status Display**
  - Current verification score
  - Verification history
  - Pending verification items
- **Admin Users Management**
  - List of admin users
  - Add/remove admin functionality

### API Endpoints
- `GET /api/charities/:id` - Retrieve charity details
- `PUT /api/charities/:id` - Update charity information
- `POST /api/charities/documentation` - Upload verification documents

## 3. Project Management

### Purpose
Create and manage charitable projects with detailed information and funding allocation plans.

### Components
- **Project List View**
  - List of all projects with status indicators
  - Filtering and sorting options
  - Quick action buttons (View, Edit, Deactivate)
- **Project Creation Form**
  - Project name
  - Description
  - Funding goal
  - Duration
  - Documentation upload
  - Funding allocation plan section
- **Project Detail View**
  - Performance metrics
  - Donation history
  - Fund utilization tracker
  - Funding status

### API Endpoints
- `GET /api/projects` - List all projects for the charity
- `POST /api/projects` - Create a new project
- `GET /api/projects/:id` - Get project details
- `PUT /api/projects/:id` - Update project information

## 4. Fund Allocation Management

### Purpose
Define, track, and plan how project funds will be utilized for different aspects of the project.

### Components
- **Allocation Plan View**
  - Breakdown of fund usage categories
  - Percentage allocations
  - Planned vs actual spending
- **Allocation Detail View**
  - Description of allocation purpose
  - Percentage of total funding
  - Expected outcomes
  - Evidence requirements for withdrawals
- **Fund Utilization Tracker**
  - Visual breakdown of all project allocations
  - Current status indicators
  - Linked withdrawal proposals

### API Endpoints
- `GET /api/projects/:id` - Get project details including fund allocations
- `POST /api/projects/:id/allocations` - Create new allocation category
- `PUT /api/projects/:id/allocations/:allocation_id` - Update allocation
- `POST /api/proposals` - Submit withdrawal proposal with evidence

## 5. Bank Account Management

### Purpose
Register and manage bank accounts for receiving funds upon withdrawal approval.

### Components
- **Bank Account List**
  - All registered bank accounts
  - Verification status
  - Purpose indicator (implementation, administrative)
- **Bank Account Registration Form**
  - Account name
  - Account number
  - Routing number
  - Bank name
  - Bank country
  - Bank address
  - SWIFT code
  - Purpose selection
- **Verification Status**
  - Current verification status
  - Required documentation
  - Verification history

### API Endpoints
- `GET /api/bank-accounts` - List all bank accounts
- `POST /api/bank-accounts` - Register a bank account
- `GET /api/bank-accounts/:id` - Get bank account details
- `PUT /api/bank-accounts/:id` - Update bank account information

## 6. Withdrawal Proposal Management

### Purpose
Create and track proposals for fund withdrawals with detailed evidence of how funds will be used.

### Components
- **Proposal List View**
  - All proposals with status indicators
  - Associated fund allocation categories
  - Requested amounts
  - Verification scores
- **Proposal Creation Form**
  - Project selection
  - Fund allocation category selection
  - Detailed description of planned use
  - Evidence upload (quotes, contracts, plans)
  - Amount requested
  - Bank account selection
- **Proposal Detail View**
  - Status tracker
  - AI verification score
  - Bank transfer details
  - Transaction history
  - Blockchain transaction data

### API Endpoints
- `GET /api/proposals/project/:id` - List all proposals for a project
- `POST /api/proposals` - Create withdrawal proposal
- `GET /api/proposals/:id/status` - Check proposal status

## 7. Donation Analytics

### Purpose
Provide detailed analytics on donations received and quadratic funding matches.

### Components
- **Donation Overview**
  - Total donations by project
  - Unique donor count
  - Average donation size
  - Time-based donation trends
- **Donor Demographics**
  - Geographic distribution
  - Repeat vs. one-time donors
  - Verification status distribution
- **Quadratic Funding Analysis**
  - Funding round information
  - Matching fund estimates
  - Historical allocation data
  - Optimization suggestions

### API Endpoints
- `GET /api/donations/project/:id` - Get donation history
- `GET /api/quadratic/current` - Get current funding round details
- `GET /api/quadratic/rounds` - List all funding rounds

## 8. Impact Reporting

### Purpose
Create and share impact reports based on completed work and project outcomes.

### Components
- **Report Builder**
  - Withdrawal evidence integration
  - Impact metrics definition
  - Narrative description fields
  - Media upload (photos, videos)
- **Report Templates**
  - Standard templates for different project types
  - Custom template builder
  - Preview functionality
- **Publishing Options**
  - Public sharing links
  - Donor notification system
  - Social media integration

### API Endpoints
- `GET /api/projects/:id` - Get project details
- `POST /api/projects/:id/reports` - Create impact report
- `GET /api/projects/:id/reports` - List impact reports

## 9. Verification Center

### Purpose
Monitor and improve the charity's verification score through documentation and evidence.

### Components
- **Verification Score Dashboard**
  - Current scores by category
  - Historical trend
  - Comparison to platform average
  - Improvement suggestions
- **Documentation Repository**
  - Uploaded verification documents
  - Status indicators
  - Renewal reminders
- **AI Verification Insights**
  - Key factors affecting score
  - Auto-detected issues
  - Improvement recommendations

### API Endpoints
- `GET /api/charities/:id` - Get charity verification details
- `POST /api/charities/verification` - Submit verification documents
- `GET /api/ai-verification/charity/:id` - Get AI verification insights

## 10. Settings & Preferences

### Purpose
Manage account settings, notifications, and integration preferences.

### Components
- **Account Settings**
  - User profile management
  - Password changes
  - Two-factor authentication
- **Notification Preferences**
  - Email notifications
  - In-app alerts
  - Donation notifications
- **Integration Settings**
  - Social media connections
  - API access management
  - Webhook configurations

### API Endpoints
- `GET /api/auth/me` - Get user profile
- `PUT /api/auth/me` - Update user profile
- `PUT /api/auth/password` - Update password
- `PUT /api/auth/notifications` - Update notification preferences
