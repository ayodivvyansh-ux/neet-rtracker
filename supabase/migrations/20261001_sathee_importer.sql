-- Database Migration for SATHEE Raw Questions and Importer RPC

-- Create sathee_raw_questions table if not exists
CREATE TABLE IF NOT EXISTS public.sathee_raw_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  source_url TEXT,
  source_question_id TEXT UNIQUE NOT NULL,
  subject TEXT NOT NULL,
  chapter TEXT,
  subtopic TEXT,
  source_type TEXT NOT NULL,
  question_text TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_answer TEXT,
  explanation TEXT,
  visual JSONB,
  raw_payload JSONB NOT NULL,
  import_status TEXT NOT NULL DEFAULT 'RAW',
  priority INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on the table
ALTER TABLE public.sathee_raw_questions ENABLE ROW LEVEL SECURITY;

-- Create public select policy
DROP POLICY IF EXISTS "Allow public select on sathee_raw_questions" ON public.sathee_raw_questions;
CREATE POLICY "Allow public select on sathee_raw_questions" ON public.sathee_raw_questions
  FOR SELECT USING (true);

-- Create public insert policy
DROP POLICY IF EXISTS "Allow public insert on sathee_raw_questions" ON public.sathee_raw_questions;
CREATE POLICY "Allow public insert on sathee_raw_questions" ON public.sathee_raw_questions
  FOR INSERT WITH CHECK (true);

-- Create public update policy
DROP POLICY IF EXISTS "Allow public update on sathee_raw_questions" ON public.sathee_raw_questions;
CREATE POLICY "Allow public update on sathee_raw_questions" ON public.sathee_raw_questions
  FOR UPDATE USING (true) WITH CHECK (true);

-- Create public delete policy
DROP POLICY IF EXISTS "Allow public delete on sathee_raw_questions" ON public.sathee_raw_questions;
CREATE POLICY "Allow public delete on sathee_raw_questions" ON public.sathee_raw_questions
  FOR DELETE USING (true);

-- Create SECURE SERVER-SIDE IMPORTER RPC
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

-- Grant permissions so anyone can call this RPC
GRANT EXECUTE ON FUNCTION public.import_sathee_raw_questions(jsonb) TO anon, authenticated;
