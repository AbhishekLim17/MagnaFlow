# 🌊 MagnaFlow — Pipeline & Workflow

---

## 1. Authentication Flow

```mermaid
sequenceDiagram
    actor U as User
    participant L as LoginPage
    participant AC as AuthContext
    participant RL as RateLimiter
    participant FA as Firebase Auth
    participant FS as Firestore

    U->>L: Submit email + password
    L->>AC: login(email, password)
    AC->>RL: withLoginRateLimit(email)
    RL-->>AC: ✅ allowed (or ❌ blocked)
    AC->>FA: signInWithEmailAndPassword()
    FA-->>AC: userCredential
    AC->>FS: getUserById(uid)
    FS-->>AC: userData {role, status}
    AC->>AC: check status === 'inactive' → signOut
    AC-->>L: { success, user }
    L->>U: Toast + redirect by role
```

**Role → Route mapping:**
| Role | Redirects To |
|:---|:---|
| `admin` | `/admin` |
| `staff` | `/staff` |
| `manager` | `/staff` ⚠️ (bug BUG-12) |

---

## 2. Task Lifecycle

```mermaid
stateDiagram-v2
    [*] --> pending : Admin creates task
    pending --> in-progress : Staff updates status\nor subtask completed
    in-progress --> completed : Staff marks done\nor all subtasks done
    pending --> completed : Direct completion
    completed --> [*]

    note right of pending
        Email sent on assignment
        Critical → alert email
    end note
    note right of completed
        completedAt timestamp set
    end note
```

---

## 3. Data Flow Pipeline

```mermaid
flowchart TD
    subgraph Frontend["React App (Vite)"]
        AC[AuthContext] --> TC[TasksContext]
        TC --> AD[AdminDashboard]
        TC --> SD[StaffDashboard]
        AC --> DC[DesignationsContext]
        AC --> CC[CompanyContext]
    end

    subgraph Services["Service Layer"]
        US[userService]
        TS[taskService]
        ES[emailService]
        SS[subtaskService]
        CS[commentService]
        NS[notificationService]
        RS[reminderService]
        AS[attachmentService]
    end

    subgraph Firebase["Firebase Backend"]
        FAuth[Firebase Auth]
        FS[(Firestore)]
        FSt[(Storage)]
    end

    AD --> US & TS & SS
    SD --> TS & SS & CS & AS
    TS --> ES
    SS --> TS
    CS --> NS
    RS --> ES
    US --> FAuth
    US & TS & SS & CS & NS & RS --> FS
    AS --> FSt & FS
```

---

## 4. Email Notification Pipeline

```mermaid
flowchart LR
    A[Task Created / Updated] --> B{Priority?}
    B -- Critical --> C[sendCriticalTaskAlert]
    B -- Other --> D[sendTaskAssignedEmail]
    C & D --> E[emailService.sendEmail]
    E --> F{EmailJS configured?}
    F -- No --> G[Skip + warn]
    F -- Yes --> H[EmailJS API]
    H --> I[logEmailToFirestore]
    I --> J[(email_logs collection)]

    K[Admin Login after 8AM] --> L{reminderSentToday?}
    L -- No --> M[checkAndSendCriticalReminders]
    M --> N[Group tasks by user]
    N --> O[1 email per user]
    O --> E
    L -- Yes --> P[Skip]
```

---

## 5. Subtask Auto-Status Pipeline

```mermaid
flowchart TD
    A[toggleSubtaskCompletion] --> B[updateSubtask in Firestore]
    B --> C[getDocs all subtasks for task]
    C --> D{completedCount / total}
    D -- all done --> E[updateTask status=completed]
    D -- some done --> F[updateTask status=in-progress]
    D -- none done --> G[no change]
    E & F --> H[dispatchEvent taskStatusUpdated]
    H --> I[TasksContext listener → loadTasks]
```

---

## 6. Comment & Mention Pipeline

```mermaid
flowchart TD
    A[User types comment] --> B[MentionInput extracts @names]
    B --> C[getUserIdsByUsernames from Firestore]
    C --> D[createComment in task_comments]
    D --> E[createNotificationsForMentions batch write]
    E --> F[(comment_notifications collection)]
    F --> G[NotificationBell realtime listener]
    G --> H[Bell badge count updates live]
```

---

## 7. Build & Deploy Pipeline

```mermaid
flowchart LR
    A[Developer] -- git push --> B[GitHub Repo]
    B --> C[Vercel CI]
    C --> D[npm run build]
    D --> E[generate-llms.js placeholder]
    E --> F[vite build]
    F --> G[dist/ bundle]
    G --> H[Vercel CDN]

    B --> I[Firebase deploy manual]
    I --> J[firestore.rules]
    I --> K[Firebase Hosting]
    I --> L[Cloud Functions]
```

**Build output:**
| Asset | Gzip Size |
|:---|:---|
| `index.css` | 9.78 kB |
| `index.js` (main) | **825 kB** ⚠️ |
| `html2canvas` chunk | 47 kB |
| `purify` chunk | 8.6 kB |

---

## 8. Role & Component Access Matrix

| Component | admin | staff | manager | principal | alpha |
|:---|:---:|:---:|:---:|:---:|:---:|
| AdminCommandCenter | ✅ | ❌ | ❌ | ❌ | ❌ |
| StaffManagement | ✅ | ❌ | ❌ | ❌ | ❌ |
| TaskManagement | ✅ | ✅ | ⚠️ | ⚠️ | ⚠️ |
| PerformanceReports | ✅ | ❌ | ✅ | ✅ | ✅ |
| DepartmentOverview | ❌ | ❌ | ✅ | ❌ | ❌ |
| PrincipalDashboard | ❌ | ❌ | ❌ | ✅ | ❌ |
| AlphaDashboard | ❌ | ❌ | ❌ | ❌ | ✅ |

> ⚠️ = Component exists but routing not wired — users are redirected to `/staff`

---

## 9. Security Layer Stack

```
Request
  └── Firebase Auth JWT (token verification)
        └── Firestore Security Rules (RBAC)
              ├── Staff: read own profile + assigned tasks only
              ├── Admin: full read/write
              └── Anyone else: denied
Client-side
  ├── RateLimiter (5 attempts / 15 min — in-memory ⚠️)
  ├── Input validation (validation.js)
  └── XSS sanitization (DOMPurify via sanitizeString)
```
