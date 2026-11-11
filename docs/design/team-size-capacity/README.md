# Team size and capacity boards

Boards for `DES-MEETUP-ADDENDUM-team-size-capacity` v1.1 (AD-8, OI-1). Mobile boards are 390x844, web boards 1280x800. `png/` for the look, `html/` for sizes, spacing and tokens (plain inline-styled markup). Status: v1, owner review pending.

| Board | Shows |
|---|---|
| M1-CreateTeam | Wizard step "Who plays?", Team: "Players per team" (1 to 11, default from config) and "Maximum participants" (6 to 128, default from config). |
| M2-CreateIndividual | Wizard step, Individual: "Maximum participants" only. No team size field. |
| M3-CreateError | Server rejection shown as a banner on the step (for example TEAM_SIZE_INVALID); the server's text is displayed. |
| M4-EditOpen | Edit screen with zero registrations: sport, mode, team size and capacity all editable. |
| M5-EditLocked | Edit screen with registrations: sport, mode and team size read-only with a lock and reason; capacity editable, floor is the registered count; fixtures-reset notice is the existing one. |
| M6-EditCapacityError | CAPACITY_BELOW_REGISTERED shown on the step, server text displayed. |
| M7-ParticipantsTeamRow | Participants row shows the team's player count from the server instead of "1 team players". |
| W1-CreateTeam | Web create, Team mode (number inputs in place of steppers). |
| W2-EditLocked | Web edit with registrations (same rules as M5). |

Rules the boards stand for: the clients show the server's refusal text and code and never re-derive them; range hints are UX only; the individual mode never shows team size; labels are agent-worded in the label registry and owner-reviewed.
