# Task Implementation Checklist
Generated: December 7, 2025 - Task Comments & Collaboration Feature

## Status Legend
[updated] - Code changes applied
[tested] - Tests passed
[todo-N] - Pending task

## Tasks

### Day 1: Database Schema & Core Services
[updated] Create task_comments collection schema in Firestore
[updated] Create task_attachments collection schema in Firestore
[updated] Create comment_notifications collection schema in Firestore
[updated] Update firestore.rules with comment security rules
[updated] Create src/services/commentService.js with CRUD operations
[updated] Create src/services/attachmentService.js with upload/download
[updated] Create src/services/notificationService.js with notification logic
[updated] Deploy Firestore rules and test permissions
[updated] Test services with manual Firestore entries

### Day 2: UI Components & Attachments
[todo-10] Create CommentSection.jsx main container component
[todo-11] Create CommentsList.jsx with real-time listener
[todo-12] Create CommentItem.jsx with edit/delete actions
[todo-13] Create CommentInput.jsx with submit functionality
[todo-14] Create MentionInput.jsx with @mention autocomplete
[todo-15] Create AttachmentUploader.jsx with drag-and-drop
[todo-16] Add file upload progress tracking
[todo-17] Add thumbnail previews for images
[todo-18] Style components with TailwindCSS

### Day 3: Notifications & Integration
[todo-19] Create NotificationBell.jsx component
[todo-20] Add notification dropdown with unread list
[todo-21] Implement real-time notification listener
[todo-22] Create EmailJS template for mention notifications
[todo-23] Integrate CommentSection into TaskDetail page
[todo-24] Add NotificationBell to Navbar
[todo-25] Add comment count badge to TaskCard
[todo-26] End-to-end testing with multiple users
[todo-27] Test @mention email delivery
[todo-28] Test file upload/download
[todo-29] Mobile responsiveness testing
[todo-30] Update documentation

## Progress Notes
- Starting with database schema and Firestore security rules
- Will implement RBAC: author + admin can edit/delete, all authenticated can read
- File size limit: 10MB per file, max 5 files per task
- Real-time updates using Firestore onSnapshot listeners
- EmailJS integration for @mention notifications
