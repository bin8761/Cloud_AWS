Goal (incl. success criteria):
- Brainstorm and finalize design for new `computers` module before implementation.
- Success: agreed design scope, architecture, validation, and testing approach for `computers`; then ready to move to implementation planning.

Constraints/Assumptions:
- Apply all rules under C:\Users\yasuo\Desktop\thuctap\rule.
- Update the ledger every turn; replies begin with Ledger Snapshot (Goal + Now/Next + Open Questions).
- Apply continuity-ledger-rule.mdc for every request.
- Work only within C:\Users\yasuo\Desktop\thuctap.
- Replies are in Vietnamese.
- Do not run DB or migration or server commands autonomously; ask the user to run.
- Do not run Prisma CLI; the user will run all Prisma CLI commands.
- When the user provides Implementation/Task/TDD structure, that is approval to proceed.
- All written content must follow UTF-8 standard: file content, UI text labels/buttons, and assistant replies.

Key decisions:
- Use this file (`CONTINUITY.md`) as canonical continuity source for this workspace.
- Start each reply with a brief Ledger Snapshot (Goal + Now/Next + Open Questions).
- Use `brainstorming` skill gate before behavior-changing implementation per session skill rules.
- Do not implement `computers` code until design is presented and approved.

State:
- Done:
  - Re-read and reaffirmed `rule/continuity-ledger-rule.mdc` on 2026-05-23.
  - Users module test phases were completed previously (API auth/list/detail/update, security/logging, unit/service tests) and last verification was green (`84/84`).
  - User confirmed `users` module is done and requested next module `computers`.
  - Loaded `$brainstorming` skill and started brainstorming workflow.
  - User decided to follow `Module Boundaries` in `docs/backend/2026-05-17-cloudcms-backend-design.md` for `computers`.
  - Confirmed `computers` scope from design doc:
    - Responsibility: register client by tenant code + MAC, issue device token, manage computer info.
    - REST endpoints: `POST /api/computers/register`, `GET /api/computers`, `GET /api/computers/:id`, `PATCH /api/computers/:id`.
  - User accepted security-hardening direction for authorization model (`ok`).
  - User approved Option 1 for registration auth: `tenantCode + registrationSecret`.
  - User prefers separating responsibilities: updates should go through update API; re-register on duplicate MAC should not silently update.
  - User approved duplicate-register policy direction: `409 CONFLICT` on existing MAC with separate admin token reissue flow.
  - User approved recommended implementation approach: Service-first.
  - User approved design section: Architecture.
  - User approved design section: Components.
  - User approved design section: Data Flow.
  - User approved design sections: Error Handling and Testing.
- Now:
  - Add missing design sections requested by user: DB design and Observability/Health/Operations.
- Next:
  - Validate DB and Observability/Health/Operations sections with user.
  - Write design doc to `docs/plans/...` after full approval.

Open questions (`UNCONFIRMED` if needed):
- `UNCONFIRMED`: Chưa duyệt section DB design cho module `computers`.
- `UNCONFIRMED`: Chưa duyệt section Observability/Health/Operations cho module `computers`.

Working set (files/ids/commands):
- `rule/continuity-ledger-rule.mdc`
- `CONTINUITY.md`
- `C:\Users\yasuo\.agents\skills\brainstorming\SKILL.md`
- `Get-Content -LiteralPath 'c:\Users\yasuo\Desktop\thuctap\CONTINUITY.md'`
- `Get-Content -LiteralPath 'c:\Users\yasuo\Desktop\thuctap\rule\continuity-ledger-rule.mdc'`
- `docs/backend/2026-05-17-cloudcms-backend-design.md`
- `rg -n "Module Boundaries|computers|Computers" docs/backend/2026-05-17-cloudcms-backend-design.md`
