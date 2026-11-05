# Sanserif private team space

The public ABSSA results and scheduled Saturday refresh remain independent of this
feature. Accounts, SportEasy events, membership, RSVPs and squads live in Supabase,
not in the public repository, static build, localStorage or service-worker cache.
Only the Supabase authentication session is persisted on the user's device.

## Membership and permissions

Email/password signup verifies the user's email once before `join_team` can run.
Returning users log in with their password. Existing email-link accounts can set
a password while signed in, or use the password setup/reset email once. Passwords
are sent only to Supabase Auth and never stored in app tables or browser storage.
New members are pending until a coach approves them. Approved members can read
team events, other approved members' names, responses and the selected squad.
Players can set only their own response. Responses do not select or deselect a
player. Coaches alone select the squad, approve/remove members and transfer coach
roles. The last approved coach cannot be demoted or removed.

All writes use PostgreSQL functions with explicit role checks. Direct browser
table writes are denied. RLS controls reads; anonymous and pending accounts cannot
read calendars or attendance. Test coverage executes the actual migrations against
PostgreSQL via PGlite, including forged writes, role changes, revocation and atomic
calendar imports. Live email delivery still requires an end-to-end test at setup.

## Deployment

1. Create a Supabase project in Europe. Run both SQL migrations in order. The
   project may enable automatic RLS; the migrations also explicitly enable it.
2. In a private SQL session, insert the chosen initial coach email into
   `team_private.bootstrap_coach`. Keep personal account details out of source.
   The entry is consumed after that person verifies their email and joins.
3. Configure Auth's Site URL to the live GitHub Pages URL with `?team=1`.
   Set custom SMTP before inviting the team; Supabase's built-in email sender is
   restricted to authorised project-team addresses. Keep email confirmation on.
4. Set GitHub repository variables `SUPABASE_URL` and
   `SUPABASE_PUBLISHABLE_KEY` (only the `sb_publishable_` key). The publish
   workflow passes these to Vite. For development use the matching
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in an ignored `.env.local`.
5. Put `SPORTEASY_CALENDAR_URL` and `SUPABASE_SECRET_KEY` in GitHub Actions
   **secrets**. Never use `VITE_` for a secret. Set `SPORTEASY_SYNC_ENABLED=true`
   only after running and checking the importer. It is scheduled hourly at :17;
   GitHub may delay jobs. No laptop or ChatGPT session is required by this job.
6. Verify sign-in with the actual coach account, pending-player signup, approval,
   RSVP, squad selection and sign-out on the live site before sharing it.

## SportEasy completeness

The player's subscription is a **partial feed**. During setup, visible future
events whose registration had not opened were absent from the export. The initial
fuller snapshot was read from the authorised SportEasy calendar UI. Source IDs
match the numeric SportEasy event IDs so later exported events update the same rows.

Hourly refresh updates only events present in that subscription. It cannot detect
all newly scheduled events or changes to events still absent from the feed. A
coach/admin subscription that includes all events is needed for complete unattended
calendar coverage. Switching secrets to a verified complete feed requires no UI
change. Never describe a player-feed refresh as a complete team-calendar refresh.

Missing events are never deleted or labelled cancelled. Explicit cancellations
are imported as cancelled. Each event shows its own last source check and an
overdue warning after 26 hours. Changed time, end, venue or cancellation increments
the event revision, prompting players to reconfirm availability. Squad selection
remains a coach decision. Failed parsing or database validation preserves the
previous rows. Recurring-rule/all-day formats are rejected until explicitly
supported; the observed feed exports individually identified, timed events.

The importer logs counts only, never subscription URLs, keys, event details or
names. Keep private initial imports outside the repository. The public service
worker only handles same-origin GitHub resources; cross-origin Supabase responses
are not cached. Changing backend hosting requires reviewing that boundary.

## Password login and recovery

The default My team screen has Log in and Create account options. Registration
uses Supabase `signUp`; login uses `signInWithPassword`. Keep email confirmation
enabled. Forgot password and first-password setup use `resetPasswordForEmail`.
Both confirmation and recovery return to the existing Site URL with `?team=1`.

The auth client subscribes to PASSWORD_RECOVERY before the lazy React panel
mounts. A per-tab UI flag preserves the password form across reloads until saved,
cancelled or signed out. It grants no access; Supabase still validates the session
and password update. Signed-in members can also use Set / change password.
Successful changes use `updateUser` on the existing identity, preserving membership.
Never set another person's password for them. Live password creation and final
login verification require the account owner to enter their chosen password.
