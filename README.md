# 🌊 MagnaFlow - Advanced Project Management System

![React](https://img.shields.io/badge/React-18.2.0-blue.svg)
![Vite](https://img.shields.io/badge/Vite-4.4.5-purple.svg)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-3.3.3-cyan.svg)
![License](https://img.shields.io/badge/License-MIT-green.svg)

MagnaFlow is a modern, feature-rich project management system built with React and Tailwind CSS. It provides role-based access control, task management, performance tracking, and an intuitive user interface with smooth animations and a dark theme.

## 🚀 Features

- **🔐 Role-Based Authentication** - Secure login system with Admin and Staff roles
- **👥 User Management** - Admin can manage staff members and their designations
- **📋 Task Management** - Create, assign, and track tasks with multiple status levels
- **📊 Performance Analytics** - Visual reports and statistics for project tracking
- **🎨 Modern UI/UX** - Dark theme with glassmorphism effects and smooth animations
- **📱 Responsive Design** - Fully responsive across all device sizes
- **💾 Local Storage** - Client-side data persistence using browser local storage

## 🏗️ Project Structure

```
MagnaFlow/
├── public/
│   └── vite.svg
├── src/
│   ├── components/
│   │   ├── admin/           # Admin-specific components
│   │   │   ├── AddStaffDialog.jsx
│   │   │   ├── AddTaskDialog.jsx
│   │   │   ├── DesignationsManagement.jsx
│   │   │   ├── EditStaffDialog.jsx
│   │   │   ├── EditTaskDialog.jsx
│   │   │   ├── PerformanceReports.jsx
│   │   │   ├── StaffManagement.jsx
│   │   │   └── TaskManagement.jsx
│   │   ├── staff/          # Staff-specific components
│   │   │   └── AddTaskDialog.jsx
│   │   └── ui/             # Reusable UI components (shadcn/ui)
│   │       ├── badge.jsx
│   │       ├── button.jsx
│   │       ├── card.jsx
│   │       ├── dialog.jsx
│   │       ├── input.jsx
│   │       ├── label.jsx
│   │       ├── select.jsx
│   │       ├── sheet.jsx
│   │       ├── textarea.jsx
│   │       ├── toast.jsx
│   │       ├── toaster.jsx
│   │       └── use-toast.js
│   ├── contexts/           # React Context providers
│   │   ├── AuthContext.jsx
│   │   └── DesignationsContext.jsx
│   ├── lib/               # Utility functions
│   │   └── utils.js
│   ├── pages/             # Main page components
│   │   ├── AdminDashboard.jsx
│   │   ├── LoginPage.jsx
│   │   └── StaffDashboard.jsx
│   ├── App.jsx            # Main application component
│   ├── index.css          # Global styles and CSS variables
│   └── main.jsx           # Application entry point
├── index.html             # HTML template
├── package.json           # Project dependencies and scripts
├── tailwind.config.js     # Tailwind CSS configuration
├── postcss.config.js      # PostCSS configuration
└── vite.config.js         # Vite build tool configuration
```

## 🛠️ Tech Stack

### Core Technologies
- **Frontend Framework**: React 18.2.0
- **Build Tool**: Vite 4.4.5
- **Routing**: React Router DOM 6.16.0
- **Styling**: Tailwind CSS 3.3.3

### UI & Design
- **Component Library**: Radix UI primitives
- **Icons**: Lucide React
- **Animations**: Framer Motion
- **Design System**: Custom components based on shadcn/ui

### State Management
- **Authentication**: React Context API
- **Data Persistence**: Browser LocalStorage
- **Form Handling**: Controlled components

### Development Tools
- **Package Manager**: npm
- **Code Quality**: ESLint
- **CSS Processing**: PostCSS with Autoprefixer

## 🚦 Getting Started

### Prerequisites
- Node.js (version 14 or higher)
- npm or yarn package manager

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd MagnaFlow
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to `http://localhost:5173`

### Build for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## 👤 Default User Accounts

The application comes with pre-configured demo accounts:

### Admin Account
- **Email**: `admin@projectflow.com`
- **Password**: `admin123`
- **Permissions**: Full system access, user management, task management, reports

### Staff Account
- **Email**: `staff@projectflow.com`
- **Password**: `staff123`
- **Permissions**: Task management, personal dashboard

## 🔄 Application Flow

### Authentication Flow

1. **Login Process**
   - User enters credentials on login page
   - System validates against localStorage users
   - On success, user data is stored in AuthContext
   - User is redirected based on their role (Admin → `/admin`, Staff → `/staff`)

2. **Protected Routes**
   - All routes except `/login` require authentication
   - Role-based access control prevents unauthorized access
   - Automatic redirection for unauthenticated users

### Admin Workflow

1. **Dashboard Overview**
   - Statistics cards showing key metrics
   - Quick actions for common tasks
   - Navigation to different management sections

2. **Staff Management**
   - View all staff members
   - Add new staff with role assignment
   - Edit existing staff information
   - Manage staff designations

3. **Task Management**
   - Create and assign tasks to staff
   - Set priorities and deadlines
   - Track task status and progress
   - Edit or delete existing tasks

4. **Performance Reports**
   - Visual analytics and charts
   - Staff performance metrics
   - Task completion statistics
   - Exportable reports

### Staff Workflow

1. **Personal Dashboard**
   - View assigned tasks
   - Track personal progress
   - Task status management

2. **Task Operations**
   - View task details
   - Update task status (Pending → In Progress → Completed)
   - Add new personal tasks
   - Filter and search tasks

## 💾 Data Management

### LocalStorage Structure

The application uses browser localStorage for data persistence:

```javascript
// User authentication
projectflow_user: {
  id: number,
  name: string,
  email: string,
  role: 'admin' | 'staff'
}

// All users in system
projectflow_users: [{
  id: number,
  name: string,
  email: string,
  password: string,
  role: 'admin' | 'staff'
}]

// Task management
projectflow_tasks: [{
  id: number,
  title: string,
  description: string,
  assignedTo: number,
  priority: 'low' | 'medium' | 'high',
  status: 'pending' | 'in-progress' | 'completed',
  dueDate: string,
  createdAt: string,
  createdBy: number
}]

// Designations
projectflow_designations: [{
  id: number,
  name: string,
  description: string
}]
```

## 🎨 Styling & Theming

### CSS Architecture

1. **Global Styles** (`src/index.css`)
   - CSS custom properties for theme colors
   - Base styles and typography
   - Custom utility classes

2. **Tailwind Configuration** (`tailwind.config.js`)
   - Extended color palette
   - Custom animations
   - Component variants

3. **Component Styling**
   - Utility-first approach with Tailwind CSS
   - Consistent design tokens
   - Responsive design patterns

### Custom CSS Classes

- `.glass-effect` - Glassmorphism background
- `.gradient-text` - Gradient text effect
- `.card-hover` - Interactive card animations
- `.animate-float` - Floating animation
- `.animate-pulse-slow` - Slow pulse animation

## 🔧 Configuration Files

### Vite Configuration (`vite.config.js`)
- React plugin setup
- Path aliases (`@` → `./src`)
- Development server configuration

### Tailwind Configuration (`tailwind.config.js`)
- Custom color system
- Extended animations
- Plugin integrations

### PostCSS Configuration (`postcss.config.js`)
- Tailwind CSS processing
- Autoprefixer for browser compatibility

## 🚀 Development Guidelines

### Code Structure
- Follow component-based architecture
- Use React hooks for state management
- Implement proper error handling
- Maintain consistent naming conventions

### Styling Guidelines
- Use Tailwind CSS utility classes
- Follow mobile-first responsive design
- Maintain consistent spacing and typography
- Use CSS custom properties for theming

### State Management
- Use React Context for global state
- Keep component state local when possible
- Implement proper data validation
- Handle loading and error states

## 🐛 Common Issues & Solutions

### Blank Page on First Load
- **Cause**: Missing dependencies or build issues
- **Solution**: Run `npm install` and `npm run dev`

### Authentication Issues
- **Cause**: LocalStorage data corruption
- **Solution**: Clear browser localStorage and refresh

### Styling Issues
- **Cause**: CSS not loading properly
- **Solution**: Check Tailwind configuration and rebuild

## 📝 API Endpoints

Currently, the application uses localStorage for data persistence. For production deployment, consider implementing:

- RESTful API endpoints
- Database integration
- Authentication middleware
- File upload handling
- Real-time updates with WebSockets

## 🔮 Future Enhancements

- [ ] Backend API integration
- [ ] Real-time notifications
- [ ] File attachment support
- [ ] Advanced reporting features
- [ ] Mobile application
- [ ] Integration with third-party tools
- [ ] Advanced user permissions
- [ ] Data export/import functionality

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Support

For support and questions, please open an issue in the GitHub repository or contact the development team.

---

**MagnaFlow** - Streamline your project management with advanced features and intuitive design.