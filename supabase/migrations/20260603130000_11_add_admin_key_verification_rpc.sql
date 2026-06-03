CREATE OR REPLACE FUNCTION public.verify_admin_key(input_key text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.org_settings
    WHERE admin_key = input_key
  );
$$;

REVOKE ALL ON FUNCTION public.verify_admin_key(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_admin_key(text) TO anon;
GRANT EXECUTE ON FUNCTION public.verify_admin_key(text) TO authenticated;
