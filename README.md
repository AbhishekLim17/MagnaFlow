# 🌊 MagnaFlow - Enterprise Multi-Tenant Project Management System

![React](https://img.shields.io/badge/React-18.2.0-blue.svg)
![Vite](https://img.shields.io/badge/Vite-7.2.6-purple.svg)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-3.3.3-cyan.svg)
![Firebase](https://img.shields.io/badge/Firebase-Auth%20%7C%20Firestore%20%7C%20Storage-orange.svg)
![License](https://img.shields.io/badge/License-MIT-green.svg)

MagnaFlow is a state-of-the-art, secure, and performant enterprise-grade project management system. Designed as a multi-tenant SaaS application, it provides robust organizational boundaries, advanced role-based access control (RBAC), real-time updates, automated notification pipelines, and optimized asset delivery.

---

## 🚀 Key Features

* **🏢 Multi-Tenant Architecture** - Complete tenant isolation. Organizations manage their own departments, projects, users, and tasks without cross-tenant exposure.
* **🔐 Robust Role-Based Access Control (RBAC)** - Security-enforced at both application and database layers (via Firestore rules). Supports 5 user tiers:
  * **Master Admin** - Global provisioning of organizations, plan billing limit controls, and audit-logged user impersonation.
  * **Org Admin** - Full management of own organization, departments, projects, and users.
  * **Department Head** - Management of projects and tasks within assigned departments.
  * **Manager** - Assigns and tracks tasks for assigned projects.
  * **Staff** - Personal dashboard to view tasks, update status, complete subtasks, and add comments.
* **💬 Comments & Mention System** - Threaded task discussions with inline `@mentions`. Resolves usernames and dispatches real-time in-app notifications and email alerts.
* **📎 Attachments & File Uploads** - Seamless file upload pipeline integrated with Firebase Storage, showing real-time progress bars.
* **🚨 Critical Alert Pipeline** - Automatically flags high-priority tasks and triggers instant notification emails. Daily summaries are scheduled at 8 AM IST using Cloud Functions to ensure no critical deadlines are missed.
* **⚡ Server-Side Rate Limiting** - Protection against brute-force logins using Cloud Functions-backed rate-limiting collections. Bypasses client-side reset exploits.
* **📉 Optimized Bundling** - Built-in Rollup code splitting (manual chunks) reducing main package delivery size by over **52%** (down to ~394kB gzip).

---

## 🏗️ Project Structure

```
MagnaFlow/
├── api/                   # Serverless functions
├── functions/             # Firebase Cloud Functions code
│   ├── index.js           # Core admin functions & rate limiters
│   └── package.json       
├── scripts/               
│   └── migrate-to-multitenant.js # Admin SDK script for data backfilling
├── src/
│   ├── components/
│   │   ├── admin/         # Org & Master dashboards, Reports, Staff management
│   │   ├── shared/        # Notification bells, layouts
│   │   ├── staff/         # Task detail modals, change password panels
│   │   ├── tasks/         # Attachment uploaders, Mention inputs, Comments
│   │   └── ui/            # Radix-UI components
│   ├── config/            
│   │   ├── firebase.js    # Firebase initialization & exports (db, auth, storage)
│   │   ├── roleRoutes.js  # Centralized RBAC page routing routes
│   │   └── emailConfig.js # EmailJS integration credentials
│   ├── contexts/          # Global state (Auth, Tasks, Designations)
│   ├── pages/             # Root views (Login, Dashboards)
│   ├── services/          # Abstracted Firestore API layer (taskStatusUtils, etc.)
│   ├── utils/             # Input sanitization, validation, rate limiting wrappers
│   ├── App.jsx            # Main router & protected RBAC route engine
│   └── index.css          # Core CSS stylesheet
├── firestore.rules        # Production-ready multi-tenant security rules
├── storage.rules          # Firebase Storage rules
├── firebase.json          # Deployment configuration
├── vite.config.js         # Custom Vite bundler & chunking setup
└── .env.example           # Decoupled template configuration variables
```

---

## 🛠️ Tech Stack

* **Frontend Framework**: React 18.2.0
* **Build Tooling**: Vite 7.2.6 & Rollup
* **Backend Infrastructure**: Firebase (Auth, Firestore, Cloud Functions, Cloud Storage)
* **Real-time Notifications**: Firestore Snapshots & Custom Event Listeners
* **Email System**: EmailJS (@emailjs/browser & @emailjs/nodejs)
* **Styling**: Tailwind CSS & Radix UI primitives
* **Security & Sanitization**: DOMPurify & Regular Expression validation

---

## 🚦 Getting Started

### 1. Prerequisites
* Node.js (version 18 or higher)
* Firebase CLI (`npm install -g firebase-tools`)

### 2. Installation
```bash
# Clone the repository
git clone <repository-url>
cd MagnaFlow

# Install frontend dependencies
npm install

# Install cloud function dependencies
cd functions && npm install && cd ..
```

### 3. Environment Setup
Copy the environment template and populate it with your credentials:
```bash
cp .env.example .env
```
*Note: `.env` is automatically ignored from git tracking.*

### 4. Running Locally
```bash
# Run local client
npm run dev

# Run Firebase emulators
firebase emulators:start
```

---

## 📊 Deployment & Operations

### Deployment
Deploy both the rules, functions, and client files:
```bash
# Deploy Backend rules and Cloud Functions
firebase deploy --only firestore:rules,functions

# Build and Deploy frontend
npm run build
# Deploy output `dist/` directory to hosting
firebase deploy --only hosting
```

### Data Migration
To transition legacy databases into the multi-tenant layout, run the migration runner:
```bash
# Ensure serviceAccountKey.json is placed in the project root
node scripts/migrate-to-multitenant.js
```
*Warning: Verify output counts against sandbox emulators before executing against production databases.*

---

## 📄 License
This project is licensed under the MIT License.