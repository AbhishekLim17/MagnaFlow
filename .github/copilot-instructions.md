# ⚙️ GitHub Copilot Strict Workflow Instructions

> **Note:** This is a project-specific copy linked to the universal configuration at `a:\Alpha\WORK\.github-global\`

## **MANDATORY PROCESS FOR EVERY TASK**

### **Step 1: Understand the Request**
- Read the complete user prompt carefully
- Identify the core problem, not just symptoms
- Determine:
  - What the user wants
  - What problem exists
  - Why it happens
  - What the desired outcome is
- **DO NOT rush to code immediately**

---

### **Step 2: Analyze Existing Codebase**
Before making ANY changes:
- Scan all relevant files in the repository
- Locate functions/components related to the feature
- Understand current implementation logic
- Identify:
  - Missing logic
  - Existing bugs
  - Bad patterns
  - Code contradictions
  - Security vulnerabilities

---

### **Step 3: Check Historical Mistakes**
- **Read `.github/mistakes.md` FIRST**
- Review past errors to avoid repetition
- Check if similar issues occurred before
- Apply lessons learned from documented solutions
- If file doesn't exist, create it for future tracking

---

### **Step 4: Root Cause Analysis**
Create solutions that address the UNDERLYING problem:
- Ask: "Why does this bug happen?"
- Ask: "How do we prevent it permanently?"
- Ask: "What system component needs improvement?"
- **NO band-aid fixes or temporary patches**
- Think architecturally, not reactively

---

### **Step 5: Create Implementation Checklist**
**OVERWRITE `.github/temp-todo.md` completely (do NOT append)**

Format:
```markdown
# Task Implementation Checklist
Generated: [timestamp]

## Status Legend
[updated] - Code changes applied
[tested] - Tests passed
[todo-N] - Pending task

## Tasks
[todo-1] Task description 1
[todo-2] Task description 2
[todo-3] Task description 3
...

## Progress Notes
- Note about approach
- Note about considerations
```

---

### **Step 6: Implement Code Changes**
Apply changes following these principles:
- **Clean, readable code**
- Remove redundant/dead code
- Add clear comments for complex logic
- Follow existing code style conventions
- Maintain backward compatibility where possible
- Ensure security best practices
- Optimize performance
- Handle edge cases
- Add proper error handling
- Validate all inputs

**Critical Areas:**
- Authentication flows
- Authorization checks
- Data validation
- API security
- Database queries
- User input handling
- File operations
- Environment variables

---

### **Step 7: Update Progress Tracker**
After implementing changes:
- Update `.github/temp-todo.md`
- Mark completed items as `[updated]`
- Add timestamps if helpful
- Note any blockers or concerns

---

### **Step 8: Create Test Scripts (When Applicable)**
Write tests for:
- Backend logic
- API endpoints
- Data processing functions
- Serverside operations
- Authentication/authorization flows
- Database operations

**Do NOT create tests for:**
- Pure UI/CSS styling changes
- Static HTML content
- Visual-only adjustments

Test requirements:
- Simple and focused
- Reflect original user intent
- Cover edge cases
- Test failure scenarios
- Validate security constraints

---

### **Step 9: Execute Tests and Iterate**
- Run all test scripts
- Verify expected behavior
- Check for edge case failures
- Validate error handling

**If tests fail:**
- Return to Step 6
- Analyze failure reason
- Fix the root cause
- Update tests if needed
- Re-run tests
- **Repeat until ALL tests pass**

**Do NOT proceed until tests are green**

---

### **Step 10: Update Progress After Testing**
- Update `.github/temp-todo.md`
- Mark tested items as `[tested]`
- Document test results
- Note any remaining concerns

---

### **Step 11: Document Learnings**
Update `.github/mistakes.md`:

Format:
```markdown
## [Date] - [Brief Issue Title]

**Problem:**
- What went wrong
- Why it happened

**Solution:**
- How it was fixed
- What changes were made

**Lesson:**
- Key takeaway
- How to avoid in future

**Related Files:**
- List of affected files

---
```

Keep entries:
- Brief but clear
- Factual, not verbose
- Focused on prevention
- Useful for future reference

---

### **Step 12: Final Review (Critical)**
Perform comprehensive code review:

**Logic Review:**
- Does the solution actually solve the problem?
- Are there any logical flaws?
- Are edge cases handled?
- Is error handling robust?

**Security Review:**
- Authentication properly enforced?
- Authorization checks in place?
- Input validation present?
- SQL injection prevented?
- XSS vulnerabilities eliminated?
- CSRF protection implemented?
- Sensitive data protected?
- API keys/secrets secured?
- Rate limiting considered?

**Quality Review:**
- Code is clean and maintainable?
- Comments are clear?
- No redundant code?
- Performance optimized?
- Follows best practices?

**If ANY concerns exist: FIX BEFORE PROCEEDING**

---

### **Step 13: Security Rating (Mandatory)**

Rate changes from 1-10 for security:

**If rating = 10:**
- Safe to proceed
- Document why it's secure

**If rating < 10:**
- **STOP IMMEDIATELY**
- Create `.github/temp-security-check.md`

Format (NO explanations, just facts):
```markdown
# Security Issues Found

## Issue 1
**File:** path/to/file.js
**Line:** 42
**Issue:** Missing input validation

## Issue 2
**File:** path/to/file.js
**Line:** 156
**Issue:** Potential SQL injection

## Issue 3
**File:** path/to/another.js
**Line:** 89
**Issue:** Hardcoded credentials
```

- Fix ALL issues
- Re-rate
- Repeat until rating = 10

---

### **Step 14: Iterate Until Perfect**

**NEVER stop at "good enough"**

Continue iterating if:
- Tests fail
- Security rating < 10
- Logic has flaws
- Edge cases exist
- Performance is poor
- Code is unclear
- Mistakes were repeated

**Use these files as guides:**
- `.github/temp-todo.md` - Track progress
- `.github/mistakes.md` - Avoid repetition
- `.github/temp-security-check.md` - Fix vulnerabilities

**Iteration cycle:**
1. Identify remaining issues
2. Return to appropriate step
3. Fix problems at root cause
4. Test again
5. Review again
6. Rate security again
7. Repeat until PERFECT

---

## **SUCCESS CRITERIA**

Task is complete ONLY when:
- ✅ All tests pass
- ✅ Security rating = 10/10
- ✅ No items remain in temp-todo.md
- ✅ Code is clean and documented
- ✅ Original user intent is 100% satisfied
- ✅ No security vulnerabilities exist
- ✅ Edge cases are handled
- ✅ Mistakes.md is updated
- ✅ Final review passed

---

## **ABSOLUTE RULES**

**NEVER:**
- Skip any step in this process
- Proceed with failing tests
- Accept security rating < 10
- Apply band-aid fixes
- Repeat documented mistakes
- Rush to finish
- Leave TODO comments in production code
- Ignore edge cases
- Skip validation
- Hardcode sensitive data

**ALWAYS:**
- Read the full prompt first
- Check mistakes.md before starting
- Solve root causes, not symptoms
- Test thoroughly
- Review honestly
- Update documentation
- Iterate until perfect
- Think about security first
- Consider user experience
- Maintain code quality

---

## **INTERNAL FILE STRUCTURE**

### `.github/temp-todo.md`
- Overwritten each task (never append)
- Tracks current implementation progress
- Uses [todo-N], [updated], [tested] markers
- Deleted or archived after task completion

### `.github/mistakes.md`
- Permanent historical record
- Append new entries (never delete old ones)
- Used to prevent repeated errors
- Brief, factual, actionable

### `.github/temp-security-check.md`
- Created only when security rating < 10
- Lists issues without explanation
- Deleted after all issues resolved
- Format: File, Line, Issue

---

## **COMMUNICATION STYLE**

When responding to users:
- Be clear and concise
- Explain what was done and why
- Highlight any important changes
- Note any limitations or considerations
- Ask clarifying questions if needed
- Never claim completion until criteria met
- Be honest about complexity and time needed

---

## **THIS IS YOUR STRICT WORKFLOW**
**Never break it. Never skip steps. Always iterate until perfect.**

The quality of your work is measured by:
- Correctness of solution
- Security of implementation  
- Thoroughness of testing
- Clarity of code
- Prevention of future issues

**Strive for excellence in every task.**
