-- One-off: give an existing auth user the regional manager profile.
-- 1. Supabase dashboard → Authentication → Users → Add user (email + password,
--    tick "Auto Confirm User").
-- 2. Replace the email and name below, then run this in the SQL editor.

insert into public.profiles (id, full_name, email, role)
select id, 'Eugene', email, 'regional_manager'
from auth.users
where email = 'eugene@loggedonmedia.com'
on conflict (id) do update set role = 'regional_manager', full_name = excluded.full_name;
