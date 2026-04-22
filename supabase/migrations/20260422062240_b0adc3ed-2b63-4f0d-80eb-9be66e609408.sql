-- Make visit-photos bucket private
UPDATE storage.buckets SET public = false WHERE id = 'visit-photos';

-- Drop overly permissive policy if exists
DROP POLICY IF EXISTS "Anyone can view visit photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own visit photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own visit photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own visit photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own visit photos" ON storage.objects;

-- Owner-scoped read (folder is user_id)
CREATE POLICY "Users can view own visit photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'visit-photos'
  AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin())
);

CREATE POLICY "Users can upload own visit photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'visit-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update own visit photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'visit-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own visit photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'visit-photos'
  AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin())
);