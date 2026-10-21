# Status: gv-mobile

**Design doc**: DES-MEETUP-ADDENDUM-game-view-redesign v1.0 APPROVED (2026-10-21). Boards: docs/design/game-view-redesign/.
**Branch**: claude/cool-pascal-84tbeh (session-designated; the brief named gv/gv-mobile, see report)
**Last updated**: 2026-10-21

## Current step
8 of 8: done. Report written, branch pushed, PR open (not merged). Waiting for the owner's review.

## Steps
| Step | State |
|---|---|
| 1 Branch + status file | done |
| 2 Labels mob.gv.* | done |
| 3 GV-1 GamesScreen | done |
| 4 EventDetailScreen (GV-2, GV-3, GV-4, GV-5, GV-7) | done (GV-3 people count and via-group tags blocked, see below) |
| 5 TournamentDetailScreen | done |
| 6 GV-6 combined user pop-up | done |
| 7 tsc, check:labels, one Jest run | done: 64 of 73 suites pass; 9 fail (8 unrelated, 1 mine fixed after the run, not re-run) |
| 8 Report, push, PR (not merged) | done |

## Blockers / open questions
- Report: docs/reports/gv-mobile-report.md (B-1 blocked item, F-1 mapper finding, decisions D-1..D-10).
- GV-3 data gap (HIGH, part only): the app has no client for `GET /events/{id}/invitations` and no documented response shape; no payload carries a per-person "via <group>" source. Players count and via-group tags are not built (see report).
