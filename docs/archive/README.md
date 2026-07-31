# Archived documentation

**These documents are historical. `/README.md` at the repository root is the
authoritative description of the system.**

Everything in this folder was written before the multi-tenant rewrite. None of
it mentions organizations, the five-tier role model (`master-admin`,
`org-admin`, `department-head`, `manager`, `staff`), or the Spark-plan
constraint that means most Cloud Functions are not deployed. Several documents
actively contradict how the system now works — for example:

- `SECURITY_AUDIT_REPORT.md` / `.txt` describe the security model as it was
  when there were only `admin` and `staff` roles and no organization scoping.
  The current rules are enforced per-organization and covered by
  `tests/firestore.rules.test.js`.
- `COMPLETE_SUMMARY.txt` and several email guides describe Cloud Functions as
  deployed. They are not: the project runs on the Firebase Spark plan, which
  cannot deploy them.
- `DEPLOYMENT_GUIDE.md` predates the current CI, where pushing to `main`
  deploys hosting only and Firestore rules must be deployed manually.

They are kept because they still contain useful context on the email pipeline,
EmailJS setup and earlier design decisions. Treat them as history, not
instructions, and verify anything here against the root README and the code
before acting on it.
