-- PostgreSQL Migration: Secure Admin Promotion & Importer RPC
-- This migration runs on the remote Supabase database with full postgres/superuser privileges.

-- 1. Create a secure trigger on auth.users to automatically assign 'admin' role metadata to admin@zenengram.app
CREATE OR REPLACE FUNCTION public.promote_admin_user()
RETURNS trigger AS $$
BEGIN
  IF NEW.email = 'admin@zenengram.app' THEN
    NEW.raw_app_meta_data := jsonb_set(COALESCE(NEW.raw_app_meta_data, '{}'::jsonb), '{role}', '"admin"');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_promote_admin_user ON auth.users;
CREATE TRIGGER tr_promote_admin_user
  BEFORE INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.promote_admin_user();

-- 2. Force-promote any existing admin@zenengram.app user record in case it was already signed up
UPDATE auth.users 
SET raw_app_meta_data = jsonb_set(COALESCE(raw_app_meta_data, '{}'::jsonb), '{role}', '"admin"')
WHERE email = 'admin@zenengram.app';

-- 3. Define the secure staging table RPC for SATHEE raw questions (ensuring it's fully registered in the schema cache)
CREATE OR REPLACE FUNCTION public.import_sathee_raw_questions(p_rows jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row jsonb;
  v_inserted INT := 0;
  v_updated INT := 0;
  v_processed INT := 0;
  v_id TEXT;
  v_exists BOOLEAN;
BEGIN
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    v_id := v_row ->> 'source_question_id';
    v_processed := v_processed + 1;
    
    -- Check if row already exists
    SELECT EXISTS(SELECT 1 FROM public.sathee_raw_questions WHERE source_question_id = v_id) INTO v_exists;
    
    INSERT INTO public.sathee_raw_questions (
      source,
      source_url,
      source_question_id,
      subject,
      chapter,
      subtopic,
      source_type,
      question_text,
      options,
      correct_answer,
      explanation,
      visual,
      raw_payload,
      import_status,
      priority
    ) VALUES (
      COALESCE(v_row ->> 'source', 'SATHEE'),
      v_row ->> 'source_url',
      v_id,
      COALESCE(v_row ->> 'subject', 'Physics'),
      v_row ->> 'chapter',
      v_row ->> 'subtopic',
      COALESCE(v_row ->> 'source_type', 'UNKNOWN'),
      COALESCE(v_row ->> 'question_text', ''),
      COALESCE(v_row -> 'options', '{}'::jsonb),
      v_row ->> 'correct_answer',
      v_row ->> 'explanation',
      v_row -> 'visual',
      COALESCE(v_row -> 'raw_payload', '{}'::jsonb),
      COALESCE(v_row ->> 'import_status', 'RAW'),
      COALESCE((v_row ->> 'priority')::int, 0)
    )
    ON CONFLICT (source_question_id) DO UPDATE SET
      source = EXCLUDED.source,
      source_url = EXCLUDED.source_url,
      subject = EXCLUDED.subject,
      chapter = EXCLUDED.chapter,
      subtopic = EXCLUDED.subtopic,
      source_type = EXCLUDED.source_type,
      question_text = EXCLUDED.question_text,
      options = EXCLUDED.options,
      correct_answer = EXCLUDED.correct_answer,
      explanation = EXCLUDED.explanation,
      visual = EXCLUDED.visual,
      raw_payload = EXCLUDED.raw_payload,
      import_status = EXCLUDED.import_status,
      priority = EXCLUDED.priority,
      updated_at = NOW();
      
    IF v_exists THEN
      v_updated := v_updated + 1;
    ELSE
      v_inserted := v_inserted + 1;
    END IF;
  END LOOP;
  
  RETURN jsonb_build_object(
    'processedCount', v_processed,
    'insertedCount', v_inserted,
    'updatedCount', v_updated
  );
END;
$$;

-- 4. Grant execution permissions on the RPC to anonymous and authenticated users
GRANT EXECUTE ON FUNCTION public.import_sathee_raw_questions(jsonb) TO anon, authenticated;
