# Trigger3D

Trigger3D is a browser-based educational platform for exploring interactive 3D firearm models and completing model-specific assessments.

## Stack

- React + Vite (JavaScript)
- React Router
- Three.js + React Three Fiber + Drei
- GSAP
- Supabase Auth, PostgreSQL, and Storage
- Vercel deployment

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Add your Supabase project URL and anonymous key.
3. Install dependencies with `npm install`.
4. Start the development server with `npm run dev`.

## Configure account roles

1. Open Supabase **SQL Editor**.
2. Run `supabase/migrations/202608030001_create_profiles_and_roles.sql`.
3. Open `supabase/bootstrap-admin.example.sql`, replace the example email with
   the existing admin Auth user's email, and run it once in the SQL Editor.
4. Sign out of Trigger3D and sign back in. The app will route the account to
   `/admin`, `/faculty`, or `/student` from its protected profile role.

New self-registered users always receive the Student role. Account roles are
stored in `public.profiles`; the browser never determines its own trusted role.
Admin and Faculty user creation must use a protected server-side operation.

## Configure classes and enrollment

After configuring account roles, run
`supabase/migrations/202608030002_create_classes_and_enrollments.sql` in the
Supabase SQL Editor. This adds Faculty-owned classes, unique class codes,
one-active-class-per-student enforcement, and the removed/re-admitted status
workflow. All enrollment mutations run through protected database functions.

## Configure firearm imports

Run `supabase/migrations/202608030003_create_firearm_import_pipeline.sql` in
the Supabase SQL Editor. It creates a private `firearm-models` Storage bucket,
the firearm/component/question tables, role-aware read policies, and the
transactional database finalizer used by the Admin import screen. The browser
validates all three files before upload and removes the GLB if finalization
fails.

## Enable the Student 3D viewer

Run `supabase/migrations/202608030004_enable_secure_model_viewing.sql` in the
Supabase SQL Editor. The private bucket remains private; enrolled Students and
authorized users receive short-lived signed URLs only for firearm rows they are
allowed to view. The Student viewer loads parts dynamically from imported
metadata and supports list/model selection, highlighting, orbit controls,
exploded/reassembled animation, and camera reset.

## Enable CSV-driven layouts and assessments

Run `supabase/migrations/202608040005_add_component_explosion_layout.sql`,
then `supabase/migrations/202608040006_create_assessment_engine.sql`. Admins can
apply revised component layouts without re-uploading a GLB. Faculty can open or
close each firearm assessment per class. Students receive a stored randomized
question order, must answer every identification question, and receive one
percentage-scored attempt per firearm.

Run `supabase/migrations/202608040007_add_faculty_assessment_results.sql` to
enable class-scoped Faculty results, protected per-question response details,
and CSV downloads compatible with Excel and Google Sheets.

Run `supabase/migrations/202608040008_add_faculty_attempt_reset.sql` to let the
owning Faculty instructor clear a submitted result, reshuffle its stored
question order, and allow that student to retake the assessment.

Run `supabase/migrations/202608040009_require_student_names.sql` to normalize
Student names and enable secure profile-name completion. New Student
registrations require a full name; existing Students without one must add it
before accessing learning materials.

Run `supabase/migrations/202608040010_add_class_archiving_and_deletion.sql`
to let Faculty archive or restore classes while preserving their records and
results, or permanently delete a class with its enrollments, attempts,
responses, and scores through database cascades.

## Enable Admin account management

Run `supabase/migrations/202608040011_add_admin_account_management.sql` to add
disabled-account enforcement and the protected Admin profile-update function.
Then deploy the server-side account function from the project directory:

```sh
supabase functions deploy admin-users --project-ref YOUR_PROJECT_REF
supabase functions deploy admin-firearms --project-ref YOUR_PROJECT_REF
```

The hosted Edge Function automatically receives `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY`. Never put the service-role key in `.env.local` or
browser code. `ALLOWED_EMAIL_DOMAIN` is optional and defaults to
`parsu.edu.ph`. The Admin dashboard can then create Faculty accounts, edit
names and roles, disable access, and permanently delete accounts with their
dependent class/student records. Imported firearm content is retained if its
original Admin uploader is deleted.

The `admin-firearms` function powers the Admin delete-and-reupload workflow.
Deleting a firearm permanently cascades through its components, questions,
assessment releases, attempts, responses, and scores, then removes its GLB
from private Storage. Exact identifier confirmation is required.

Run `supabase/migrations/202608040012_enforce_student_email_domain.sql` to
enforce the exact `parsu.edu.ph` email domain inside the Auth profile trigger.
This database check prevents direct signup requests from bypassing the browser
validation. It applies to newly created accounts and does not alter existing
users.

Run `supabase/migrations/202608040013_add_assessment_attempt_revision.sql` to
enable safe on-device assessment draft recovery. In-progress answers and the
current question survive refreshes and accidental tab closure. A Faculty reset
changes the attempt revision, preventing old answers from being restored into
a retake.

Run `supabase/migrations/202608040014_lock_model_during_assessment.sql` to
block Student access to a firearm's component metadata and private GLB while
that firearm's assessment is in progress. The dashboard routes the Student
back to the assessment, and a cross-tab lock unloads an already-open viewer.

Run `supabase/migrations/202608040015_randomize_half_assessment_questions.sql`
to assign a random 50% of each firearm's question bank per attempt, rounded up
for odd totals. Faculty resets generate a new half-bank sample and order.

Run `supabase/migrations/202608040016_harden_account_deletion.sql` and redeploy
`admin-users` to keep retained content/audit references from blocking account
deletion. If Supabase cannot permanently delete a Storage-owning Auth user, the
function falls back to an anonymized, disabled Auth tombstone while removing
the Trigger3D profile and its dependent application records.

Run `supabase/migrations/202608040017_restore_full_assessment_question_bank.sql`
to supersede migration 015 and restore the complete question bank for each
new or Faculty-reset attempt. Question order remains randomized.

## Initial structure

- `src/features/admin` — analytics, account management, and firearm imports
- `src/features/faculty` — classes, enrollment management, assessment release, and results
- `src/features/student` — enrollment, 3D viewer, assessments, and scores
- `src/lib` — shared service clients such as Supabase
- `src/pages` — route-level screens

Signed-in Admin, Faculty, and Student accounts can change their own password
from the shared dashboard header. Trigger3D verifies the current password
before sending the new password through Supabase Auth.
