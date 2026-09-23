-- The existing tasks_employee_due_idx already covers these same columns.
-- Keep the original index and remove only the redundant index added in team management.
drop index if exists public.tasks_employee_status_due_idx;
