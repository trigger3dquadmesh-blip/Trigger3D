-- Run the roles migration before this script.
-- Replace the example email with the Auth user who should be the first admin.
-- Run this once in the Supabase SQL Editor, then verify that one row changed.

update public.profiles
set role = 'admin'
where lower(email) = lower('your-admin-email@example.com');

select id, email, role
from public.profiles
order by created_at;
