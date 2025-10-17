# 🗄️ MagnaFlow Database Schema

## Collections Overview

### 1. **users** Collection
- **Primary Key**: Auto-generated document ID
- **Indexes Needed**:
  - `tier` (for filtering Alpha, Principal, etc.)
  - `companyId` (for company-specific queries)
  - `email` (for authentication)
  - `tier + companyId` (composite index)

### 2. **companies** Collection  
- **Primary Key**: Auto-generated document ID
- **Indexes Needed**:
  - `status` (active/inactive filtering)
  - `principalId` (for principal assignment queries)
  - `createdAt` (for sorting)

### 3. **performanceReports** Collection
- **Primary Key**: Auto-generated document ID
- **Indexes Needed**:
  - `companyId` (for company-specific reports)
  - `employeeId` (for user-specific reports)
  - `status` (for filtering report status)
  - `companyId + createdAt` (composite for sorted company reports)

### 4. **departments** Collection
- **Primary Key**: Auto-generated document ID
- **Indexes Needed**:
  - `companyId` (for company-specific departments)

### 5. **designations** Collection
- **Primary Key**: Auto-generated document ID  
- **Indexes Needed**:
  - `companyId` (for company-specific designations)
  - `department` (for department-specific designations)

## Key Relationships

```
Alpha User (tier: "Alpha")
├── Can access all companies
├── Can create/modify companies
└── Can assign Principals to companies

Company
├── Has one Principal (company owner)
├── Has multiple users (employees)
├── Has multiple departments
├── Has multiple designations
└── Has multiple performance reports

Principal User (tier: "Principal")  
├── Owns one company (via principalId in companies)
├── Can view company performance reports
├── Can manage company employees
└── Cannot access other companies

Admin User (role: "admin")
├── Belongs to one company (via companyId)
├── Can manage users in their company
├── Can create departments/designations for their company
└── Cannot access other companies

Regular Users (Manager/Staff)
├── Belong to one company (via companyId)
├── Have one department and designation
├── Can have performance reports
└── Limited access within their company
```

## Security Rules Considerations

### Firestore Security Rules Structure:
```javascript
// Users can only read/write their own data unless they're Alpha/Principal/Admin
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Users collection
    match /users/{userId} {
      allow read, write: if request.auth != null && 
        (request.auth.uid == userId || 
         resource.data.tier == 'Alpha' ||
         (resource.data.tier == 'Principal' && resource.data.companyId == request.auth.token.companyId) ||
         (resource.data.role == 'admin' && resource.data.companyId == request.auth.token.companyId));
    }
    
    // Companies collection - only Alpha can create/modify
    match /companies/{companyId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.token.tier == 'Alpha';
    }
    
    // Performance reports - company-specific access
    match /performanceReports/{reportId} {
      allow read, write: if request.auth != null && 
        (request.auth.token.tier == 'Alpha' ||
         (request.auth.token.tier == 'Principal' && resource.data.companyId == request.auth.token.companyId) ||
         (request.auth.token.role == 'admin' && resource.data.companyId == request.auth.token.companyId));
    }
    
    // Departments - company-specific
    match /departments/{deptId} {
      allow read, write: if request.auth != null && 
        (request.auth.token.tier == 'Alpha' ||
         resource.data.companyId == request.auth.token.companyId);
    }
    
    // Designations - company-specific  
    match /designations/{designationId} {
      allow read, write: if request.auth != null && 
        (request.auth.token.tier == 'Alpha' ||
         resource.data.companyId == request.auth.token.companyId);
    }
  }
}
```

## Data Flow Examples

### 1. Alpha Creates Company:
1. Alpha logs in → gets `tier: "Alpha"` token
2. Alpha creates company in `/companies` collection
3. Company gets unique ID and status "active"

### 2. Alpha Assigns Principal:
1. Alpha selects Principal user from `/users` where `tier: "Principal"`
2. Updates company document: `principalId: "user-uuid"`
3. Updates user document: `companyId: "company-uuid"`

### 3. Principal Views Company Data:
1. Principal logs in → gets `tier: "Principal"` and `companyId` token  
2. Queries `/users` where `companyId: "their-company-id"`
3. Queries `/performanceReports` where `companyId: "their-company-id"`

### 4. Admin Manages Users:
1. Admin logs in → gets `role: "admin"` and `companyId` token
2. Can create/modify users with same `companyId`
3. Cannot access users from other companies