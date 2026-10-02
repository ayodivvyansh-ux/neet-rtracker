-- =========================================================================
-- NEET UG Secure Exam Scoring RPC Function & Security Policies
-- =========================================================================

-- Enable RLS on all tables
ALTER TABLE IF EXISTS neet_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS neet_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS neet_test_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS neet_question_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS neet_test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS neet_source_pdfs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS neet_result_pdfs ENABLE ROW LEVEL SECURITY;

-- 1. Security Policies for user-owned tables
CREATE POLICY "Users can manage own tests" ON neet_tests
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own answers" ON neet_test_answers
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own results" ON neet_test_results
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own attempts" ON neet_question_attempts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own result PDFs" ON neet_result_pdfs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 2. Public Read for Exam Questions
-- Allows authenticated students to read question text and options during exams
CREATE POLICY "Public exam questions read" ON neet_questions
  FOR SELECT TO authenticated USING (true);

-- =========================================================================
-- SECURE SERVER-SIDE SCORING RPC
-- =========================================================================

CREATE OR REPLACE FUNCTION submit_and_score_exam(
  p_test_id TEXT,
  p_user_responses JSONB,
  p_question_statuses JSONB,
  p_time_spent JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_test RECORD;
  v_question_ids JSONB;
  v_q RECORD;
  v_user_ans TEXT;
  v_status TEXT;
  v_time_spent INT;
  v_correct_count INT := 0;
  v_incorrect_count INT := 0;
  v_unattempted_count INT := 0;
  v_unknown_key_count INT := 0;
  v_total_score INT := 0;
  v_scorable_count INT := 0;
  v_accuracy NUMERIC := 0;
  v_attempt_percentage NUMERIC := 0;
  v_evaluation_status TEXT := 'EVALUATED';
  v_subject_wise JSONB := '{"Physics": {"correct":0,"incorrect":0,"unattempted":0,"unknownKeys":0,"score":0,"maxScore":0}, "Chemistry": {"correct":0,"incorrect":0,"unattempted":0,"unknownKeys":0,"score":0,"maxScore":0}, "Biology": {"correct":0,"incorrect":0,"unattempted":0,"unknownKeys":0,"score":0,"maxScore":0}}'::JSONB;
  v_chapter_wise JSONB := '{}'::JSONB;
  v_evaluated_questions JSONB := '[]'::JSONB;
  v_subj TEXT;
  v_chap TEXT;
  v_marks INT;
  v_now TIMESTAMPTZ := NOW();
  v_now_epoch BIGINT := (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT;
BEGIN
  -- 1. Verify authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated request. User session required.';
  END IF;

  -- 2. Verify test exists and belongs to current user
  SELECT * INTO v_test FROM neet_tests WHERE id = p_test_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Test session not found with ID %', p_test_id;
  END IF;

  IF v_test.user_id <> v_user_id THEN
    RAISE EXCEPTION 'Unauthorized: You do not own this test session.';
  END IF;

  -- 3. Verify test is not already submitted (reject duplicates)
  IF v_test.is_submitted THEN
    RAISE EXCEPTION 'Test session % is already submitted and scored.', p_test_id;
  END IF;

  -- 4. Verify question IDs
  v_question_ids := v_test.question_ids;

  -- 5. Loop through each question in the test and evaluate
  FOR v_q IN 
    SELECT id, text, options, correct_answer, subject, chapter, subtopic, difficulty, source_pdf_name, page_number, explanation
    FROM neet_questions
    WHERE id IN (SELECT jsonb_array_elements_text(v_question_ids))
  LOOP
    v_user_ans := p_user_responses ->> v_q.id;
    v_time_spent := COALESCE((p_time_spent ->> v_q.id)::INT, 0);
    v_subj := v_q.subject;
    v_chap := COALESCE(v_q.chapter, 'General');

    -- Initialize chapter in v_chapter_wise if not present
    IF NOT (v_chapter_wise ? v_chap) THEN
      v_chapter_wise := jsonb_set(
        v_chapter_wise,
        ARRAY[v_chap],
        jsonb_build_object(
          'subject', v_subj,
          'correct', 0,
          'incorrect', 0,
          'unattempted', 0,
          'unknownKeys', 0,
          'score', 0,
          'maxScore', 0
        )
      );
    END IF;

    -- Handle UNKNOWN Answer Keys (Do not score +/-)
    IF v_q.correct_answer = 'UNKNOWN' OR v_q.correct_answer IS NULL THEN
      v_status := 'unknown_key';
      v_marks := 0;
      v_unknown_key_count := v_unknown_key_count + 1;
      v_evaluation_status := 'HAS_UNKNOWN_KEYS';

      -- Update counts
      v_subject_wise := jsonb_set(v_subject_wise, ARRAY[v_subj, 'unknownKeys'], to_jsonb((v_subject_wise -> v_subj ->> 'unknownKeys')::INT + 1));
      v_chapter_wise := jsonb_set(v_chapter_wise, ARRAY[v_chap, 'unknownKeys'], to_jsonb((v_chapter_wise -> v_chap ->> 'unknownKeys')::INT + 1));

    ELSIF v_user_ans IS NULL OR v_user_ans = '' THEN
      -- Unattempted: 0 marks
      v_status := 'unattempted';
      v_marks := 0;
      v_unattempted_count := v_unattempted_count + 1;
      v_scorable_count := v_scorable_count + 1;

      v_subject_wise := jsonb_set(v_subject_wise, ARRAY[v_subj, 'maxScore'], to_jsonb((v_subject_wise -> v_subj ->> 'maxScore')::INT + 4));
      v_subject_wise := jsonb_set(v_subject_wise, ARRAY[v_subj, 'unattempted'], to_jsonb((v_subject_wise -> v_subj ->> 'unattempted')::INT + 1));

      v_chapter_wise := jsonb_set(v_chapter_wise, ARRAY[v_chap, 'maxScore'], to_jsonb((v_chapter_wise -> v_chap ->> 'maxScore')::INT + 4));
      v_chapter_wise := jsonb_set(v_chapter_wise, ARRAY[v_chap, 'unattempted'], to_jsonb((v_chapter_wise -> v_chap ->> 'unattempted')::INT + 1));

    ELSIF v_user_ans = v_q.correct_answer THEN
      -- Correct: +4 marks
      v_status := 'correct';
      v_marks := 4;
      v_correct_count := v_correct_count + 1;
      v_total_score := v_total_score + 4;
      v_scorable_count := v_scorable_count + 1;

      v_subject_wise := jsonb_set(v_subject_wise, ARRAY[v_subj, 'maxScore'], to_jsonb((v_subject_wise -> v_subj ->> 'maxScore')::INT + 4));
      v_subject_wise := jsonb_set(v_subject_wise, ARRAY[v_subj, 'correct'], to_jsonb((v_subject_wise -> v_subj ->> 'correct')::INT + 1));
      v_subject_wise := jsonb_set(v_subject_wise, ARRAY[v_subj, 'score'], to_jsonb((v_subject_wise -> v_subj ->> 'score')::INT + 4));

      v_chapter_wise := jsonb_set(v_chapter_wise, ARRAY[v_chap, 'maxScore'], to_jsonb((v_chapter_wise -> v_chap ->> 'maxScore')::INT + 4));
      v_chapter_wise := jsonb_set(v_chapter_wise, ARRAY[v_chap, 'correct'], to_jsonb((v_chapter_wise -> v_chap ->> 'correct')::INT + 1));
      v_chapter_wise := jsonb_set(v_chapter_wise, ARRAY[v_chap, 'score'], to_jsonb((v_chapter_wise -> v_chap ->> 'score')::INT + 4));

    ELSE
      -- Incorrect: -1 mark
      v_status := 'incorrect';
      v_marks := -1;
      v_incorrect_count := v_incorrect_count + 1;
      v_total_score := v_total_score - 1;
      v_scorable_count := v_scorable_count + 1;

      v_subject_wise := jsonb_set(v_subject_wise, ARRAY[v_subj, 'maxScore'], to_jsonb((v_subject_wise -> v_subj ->> 'maxScore')::INT + 4));
      v_subject_wise := jsonb_set(v_subject_wise, ARRAY[v_subj, 'incorrect'], to_jsonb((v_subject_wise -> v_subj ->> 'incorrect')::INT + 1));
      v_subject_wise := jsonb_set(v_subject_wise, ARRAY[v_subj, 'score'], to_jsonb((v_subject_wise -> v_subj ->> 'score')::INT - 1));

      v_chapter_wise := jsonb_set(v_chapter_wise, ARRAY[v_chap, 'maxScore'], to_jsonb((v_chapter_wise -> v_chap ->> 'maxScore')::INT + 4));
      v_chapter_wise := jsonb_set(v_chapter_wise, ARRAY[v_chap, 'incorrect'], to_jsonb((v_chapter_wise -> v_chap ->> 'incorrect')::INT + 1));
      v_chapter_wise := jsonb_set(v_chapter_wise, ARRAY[v_chap, 'score'], to_jsonb((v_chapter_wise -> v_chap ->> 'score')::INT - 1));
    END IF;

    -- Append evaluated question summary
    v_evaluated_questions := v_evaluated_questions || jsonb_build_object(
      'id', v_q.id,
      'text', v_q.text,
      'options', v_q.options,
      'subject', v_q.subject,
      'chapter', v_q.chapter,
      'subtopic', v_q.subtopic,
      'difficulty', v_q.difficulty,
      'sourcePdf', v_q.source_pdf_name,
      'pageNumber', v_q.page_number,
      'explanation', v_q.explanation,
      'userAnswer', v_user_ans,
      'correctAnswer', v_q.correct_answer,
      'status', v_status,
      'marksAwarded', v_marks
    );

    -- Insert into neet_question_attempts
    INSERT INTO neet_question_attempts(user_id, test_id, question_id, user_answer, status, time_spent_seconds, attempted_at)
    VALUES (v_user_id, p_test_id, v_q.id, v_user_ans, v_status, v_time_spent, v_now);

    -- Upsert into neet_test_answers
    INSERT INTO neet_test_answers(user_id, test_id, question_id, user_answer, status, time_spent_seconds, answered_at)
    VALUES (v_user_id, p_test_id, v_q.id, v_user_ans, COALESCE(p_question_statuses ->> v_q.id, 'ANSWERED'), v_time_spent, v_now)
    ON CONFLICT (test_id, question_id) DO UPDATE
    SET user_answer = EXCLUDED.user_answer,
        status = EXCLUDED.status,
        time_spent_seconds = EXCLUDED.time_spent_seconds,
        answered_at = EXCLUDED.answered_at;
  END LOOP;

  -- Compute accuracy and attempt percentage
  IF (v_correct_count + v_incorrect_count) > 0 THEN
    v_accuracy := ROUND(((v_correct_count::NUMERIC / (v_correct_count + v_incorrect_count)::NUMERIC) * 100), 1);
  ELSE
    v_accuracy := 0;
  END IF;

  IF v_scorable_count > 0 THEN
    v_attempt_percentage := ROUND((((v_correct_count + v_incorrect_count)::NUMERIC / v_scorable_count::NUMERIC) * 100), 1);
  ELSE
    v_attempt_percentage := 0;
  END IF;

  -- 6. Insert / Upsert into neet_test_results
  INSERT INTO neet_test_results(
    test_id,
    user_id,
    total_score,
    max_score,
    correct_count,
    incorrect_count,
    unattempted_count,
    unknown_key_count,
    accuracy,
    attempt_percentage,
    evaluation_status,
    subject_wise,
    chapter_wise
  ) VALUES (
    p_test_id,
    v_user_id,
    v_total_score,
    v_scorable_count * 4,
    v_correct_count,
    v_incorrect_count,
    v_unattempted_count,
    v_unknown_key_count,
    v_accuracy,
    v_attempt_percentage,
    v_evaluation_status,
    v_subject_wise,
    v_chapter_wise
  )
  ON CONFLICT (test_id) DO UPDATE
  SET total_score = EXCLUDED.total_score,
      max_score = EXCLUDED.max_score,
      correct_count = EXCLUDED.correct_count,
      incorrect_count = EXCLUDED.incorrect_count,
      unattempted_count = EXCLUDED.unattempted_count,
      unknown_key_count = EXCLUDED.unknown_key_count,
      accuracy = EXCLUDED.accuracy,
      attempt_percentage = EXCLUDED.attempt_percentage,
      evaluation_status = EXCLUDED.evaluation_status,
      subject_wise = EXCLUDED.subject_wise,
      chapter_wise = EXCLUDED.chapter_wise;

  -- 7. Mark test as submitted in neet_tests
  UPDATE neet_tests
  SET is_submitted = TRUE,
      completed_at = v_now
  WHERE id = p_test_id;

  -- 8. Return secure evaluation payload to client
  RETURN jsonb_build_object(
    'testId', p_test_id,
    'completedAt', v_now_epoch,
    'score', jsonb_build_object(
      'totalScore', v_total_score,
      'maxScore', v_scorable_count * 4,
      'correctCount', v_correct_count,
      'incorrectCount', v_incorrect_count,
      'unattemptedCount', v_unattempted_count,
      'unknownKeyCount', v_unknown_key_count,
      'accuracy', v_accuracy,
      'attemptPercentage', v_attempt_percentage,
      'evaluationStatus', v_evaluation_status,
      'subjectWise', v_subject_wise,
      'chapterWise', v_chapter_wise
    ),
    'evaluatedQuestions', v_evaluated_questions
  );
END;
$$;
