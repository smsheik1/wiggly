# Host-only SQL integration

The historical `SKILL.md` and `runner.mjs` remain authoritative for existing runs.
The director separately authorized an isolated Deep Agents / SQLite integration in
`v3/scripts/studio-spike/memoir-format.ts`. Its setup, free tests, mock interpretation,
exact-version approvals, and portable share boundary are documented in that directory's
README. Use that entry point only in an explicitly isolated studio workspace. It reuses
this Format's contracts, role skills, validators, media inspectors, and official renderer;
it never applies events to an existing legacy run or resumes saved production.

No credentials belong in this package. No new production coordination authority is
conferred by this document. Do not mix the SQL adapter and legacy runner on one project.
