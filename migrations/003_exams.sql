-- 003_exams: question bank, exams, attempts. Used questions are archived, never deleted.

IF OBJECT_ID('dbo.questions') IS NULL
CREATE TABLE dbo.questions (
  question_id           INT IDENTITY(1,1) NOT NULL,
  module_id             INT            NOT NULL,
  subject_id            INT            NOT NULL,
  course_id             INT            NOT NULL,
  type                  VARCHAR(14)    NOT NULL CONSTRAINT CK_questions_type CHECK (type IN ('mcq','true_false','fill_blank','multi_correct')),
  text                  NVARCHAR(2000) NOT NULL,
  difficulty            VARCHAR(6)     NOT NULL CONSTRAINT DF_questions_diff DEFAULT 'medium'
                        CONSTRAINT CK_questions_diff CHECK (difficulty IN ('easy','medium','hard')),
  marks                 DECIMAL(5,2)   NOT NULL CONSTRAINT DF_questions_marks DEFAULT 1 CONSTRAINT CK_questions_marks CHECK (marks > 0),
  negative_marks        DECIMAL(5,2)   NOT NULL CONSTRAINT DF_questions_neg DEFAULT 0,
  explanation           NVARCHAR(2000) NULL,
  accepted_answers_json NVARCHAR(1000) NULL,
  is_archived           BIT            NOT NULL CONSTRAINT DF_questions_arch DEFAULT 0,
  replaced_by           INT            NULL,
  created_at            DATETIME2(3)   NOT NULL CONSTRAINT DF_questions_created DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_questions PRIMARY KEY CLUSTERED (question_id),
  CONSTRAINT FK_questions_module FOREIGN KEY (module_id) REFERENCES dbo.modules(module_id),
  CONSTRAINT FK_questions_subject FOREIGN KEY (subject_id) REFERENCES dbo.subjects(subject_id),
  CONSTRAINT FK_questions_course FOREIGN KEY (course_id) REFERENCES dbo.courses(course_id),
  CONSTRAINT FK_questions_replaced FOREIGN KEY (replaced_by) REFERENCES dbo.questions(question_id),
  CONSTRAINT CK_questions_negative CHECK (negative_marks >= 0 AND negative_marks <= marks)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_questions_module')
  CREATE INDEX IX_questions_module ON dbo.questions (module_id, is_archived, difficulty);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_questions_subject')
  CREATE INDEX IX_questions_subject ON dbo.questions (subject_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_questions_course')
  CREATE INDEX IX_questions_course ON dbo.questions (course_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_questions_replaced')
  CREATE INDEX IX_questions_replaced ON dbo.questions (replaced_by);
GO

IF OBJECT_ID('dbo.question_options') IS NULL
CREATE TABLE dbo.question_options (
  option_id   INT IDENTITY(1,1) NOT NULL,
  question_id INT           NOT NULL,
  text        NVARCHAR(500) NOT NULL,
  is_correct  BIT           NOT NULL,
  sort_order  INT           NOT NULL,
  CONSTRAINT PK_question_options PRIMARY KEY CLUSTERED (option_id),
  CONSTRAINT FK_qoptions_question FOREIGN KEY (question_id) REFERENCES dbo.questions(question_id)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_qoptions_question')
  CREATE INDEX IX_qoptions_question ON dbo.question_options (question_id, sort_order);
GO

IF OBJECT_ID('dbo.exams') IS NULL
CREATE TABLE dbo.exams (
  exam_id           INT IDENTITY(1,1) NOT NULL,
  public_id         UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_exams_public DEFAULT NEWID(),
  course_id         INT           NOT NULL,
  title             NVARCHAR(200) NOT NULL,
  scope             VARCHAR(8)    NOT NULL CONSTRAINT CK_exams_scope CHECK (scope IN ('module','modules','course')),
  mode              VARCHAR(8)    NOT NULL CONSTRAINT CK_exams_mode CHECK (mode IN ('practice','mock')),
  selection         VARCHAR(6)    NOT NULL CONSTRAINT CK_exams_selection CHECK (selection IN ('manual','random')),
  category          VARCHAR(12)   NOT NULL CONSTRAINT CK_exams_category CHECK (category IN ('unit_test_1','unit_test_2','final','practice')),
  weightage         DECIMAL(5,2)  NOT NULL CONSTRAINT DF_exams_weight DEFAULT 0 CONSTRAINT CK_exams_weight CHECK (weightage BETWEEN 0 AND 100),
  total_marks       DECIMAL(6,2)  NULL,
  negative_marking  BIT           NOT NULL CONSTRAINT DF_exams_neg DEFAULT 0,
  time_limit_min    INT           NULL CONSTRAINT CK_exams_time CHECK (time_limit_min IS NULL OR time_limit_min BETWEEN 1 AND 600),
  passing_pct       DECIMAL(5,2)  NULL CONSTRAINT CK_exams_pass CHECK (passing_pct IS NULL OR passing_pct BETWEEN 0 AND 100),
  shuffle_questions BIT           NOT NULL CONSTRAINT DF_exams_shq DEFAULT 0,
  shuffle_options   BIT           NOT NULL CONSTRAINT DF_exams_sho DEFAULT 0,
  attempt_limit     INT           NULL CONSTRAINT CK_exams_attempts CHECK (attempt_limit IS NULL OR attempt_limit >= 1),
  starts_at         DATETIME2(3)  NULL,
  ends_at           DATETIME2(3)  NULL,
  status            VARCHAR(10)   NOT NULL CONSTRAINT DF_exams_status DEFAULT 'draft' CONSTRAINT CK_exams_status CHECK (status IN ('draft','published')),
  published_at      DATETIME2(3)  NULL,
  created_at        DATETIME2(3)  NOT NULL CONSTRAINT DF_exams_created DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_exams PRIMARY KEY CLUSTERED (exam_id),
  CONSTRAINT UQ_exams_public UNIQUE (public_id),
  CONSTRAINT FK_exams_course FOREIGN KEY (course_id) REFERENCES dbo.courses(course_id)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_exams_course')
  CREATE INDEX IX_exams_course ON dbo.exams (course_id, status);
GO

IF OBJECT_ID('dbo.exam_modules') IS NULL
CREATE TABLE dbo.exam_modules (
  exam_id      INT NOT NULL,
  module_id    INT NOT NULL,
  easy_count   INT NOT NULL CONSTRAINT DF_em_easy DEFAULT 0,
  medium_count INT NOT NULL CONSTRAINT DF_em_medium DEFAULT 0,
  hard_count   INT NOT NULL CONSTRAINT DF_em_hard DEFAULT 0,
  CONSTRAINT PK_exam_modules PRIMARY KEY CLUSTERED (exam_id, module_id),
  CONSTRAINT FK_em_exam FOREIGN KEY (exam_id) REFERENCES dbo.exams(exam_id),
  CONSTRAINT FK_em_module FOREIGN KEY (module_id) REFERENCES dbo.modules(module_id),
  CONSTRAINT CK_em_counts CHECK (easy_count >= 0 AND medium_count >= 0 AND hard_count >= 0)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_em_module')
  CREATE INDEX IX_em_module ON dbo.exam_modules (module_id);
GO

IF OBJECT_ID('dbo.exam_questions') IS NULL
CREATE TABLE dbo.exam_questions (
  exam_id     INT NOT NULL,
  question_id INT NOT NULL,
  sort_order  INT NOT NULL,
  CONSTRAINT PK_exam_questions PRIMARY KEY CLUSTERED (exam_id, question_id),
  CONSTRAINT FK_eq_exam FOREIGN KEY (exam_id) REFERENCES dbo.exams(exam_id),
  CONSTRAINT FK_eq_question FOREIGN KEY (question_id) REFERENCES dbo.questions(question_id)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_eq_question')
  CREATE INDEX IX_eq_question ON dbo.exam_questions (question_id);
GO

IF OBJECT_ID('dbo.exam_batches') IS NULL
CREATE TABLE dbo.exam_batches (
  exam_id  INT NOT NULL,
  batch_id INT NOT NULL,
  CONSTRAINT PK_exam_batches PRIMARY KEY CLUSTERED (exam_id, batch_id),
  CONSTRAINT FK_eb_exam FOREIGN KEY (exam_id) REFERENCES dbo.exams(exam_id),
  CONSTRAINT FK_eb_batch FOREIGN KEY (batch_id) REFERENCES dbo.batches(batch_id)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_eb_batch')
  CREATE INDEX IX_eb_batch ON dbo.exam_batches (batch_id);
GO

IF OBJECT_ID('dbo.exam_attempts') IS NULL
CREATE TABLE dbo.exam_attempts (
  attempt_id      INT IDENTITY(1,1) NOT NULL,
  public_id       UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_attempts_public DEFAULT NEWID(),
  exam_id         INT           NOT NULL,
  student_id      INT           NOT NULL,
  attempt_no      INT           NOT NULL,
  seed            INT           NOT NULL,
  started_at      DATETIME2(3)  NOT NULL,
  deadline_at     DATETIME2(3)  NULL,
  submitted_at    DATETIME2(3)  NULL,
  auto_submitted  BIT           NOT NULL CONSTRAINT DF_attempts_auto DEFAULT 0,
  score           DECIMAL(7,2)  NULL,
  max_score       DECIMAL(7,2)  NULL,
  passed          BIT           NULL,
  per_module_json NVARCHAR(MAX) NULL,
  CONSTRAINT PK_exam_attempts PRIMARY KEY CLUSTERED (attempt_id),
  CONSTRAINT UQ_attempts_public UNIQUE (public_id),
  CONSTRAINT UQ_attempts_no UNIQUE (exam_id, student_id, attempt_no),
  CONSTRAINT FK_attempts_exam FOREIGN KEY (exam_id) REFERENCES dbo.exams(exam_id),
  CONSTRAINT FK_attempts_student FOREIGN KEY (student_id) REFERENCES dbo.users(user_id)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_attempts_student')
  CREATE INDEX IX_attempts_student ON dbo.exam_attempts (student_id, exam_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_attempts_open')
  CREATE INDEX IX_attempts_open ON dbo.exam_attempts (deadline_at) WHERE submitted_at IS NULL;
GO

IF OBJECT_ID('dbo.exam_attempt_questions') IS NULL
CREATE TABLE dbo.exam_attempt_questions (
  attempt_id        INT          NOT NULL,
  question_id       INT          NOT NULL,
  sort_order        INT          NOT NULL,
  option_order_json VARCHAR(200) NULL,
  CONSTRAINT PK_attempt_questions PRIMARY KEY CLUSTERED (attempt_id, question_id),
  CONSTRAINT FK_aq_attempt FOREIGN KEY (attempt_id) REFERENCES dbo.exam_attempts(attempt_id),
  CONSTRAINT FK_aq_question FOREIGN KEY (question_id) REFERENCES dbo.questions(question_id)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_aq_question')
  CREATE INDEX IX_aq_question ON dbo.exam_attempt_questions (question_id);
GO

IF OBJECT_ID('dbo.attempt_answers') IS NULL
CREATE TABLE dbo.attempt_answers (
  attempt_id    INT            NOT NULL,
  question_id   INT            NOT NULL,
  answer_json   NVARCHAR(1000) NOT NULL,
  is_correct    BIT            NULL,
  marks_awarded DECIMAL(5,2)   NULL,
  saved_at      DATETIME2(3)   NOT NULL,
  CONSTRAINT PK_attempt_answers PRIMARY KEY CLUSTERED (attempt_id, question_id),
  CONSTRAINT FK_aa_attempt FOREIGN KEY (attempt_id) REFERENCES dbo.exam_attempts(attempt_id),
  CONSTRAINT FK_aa_question FOREIGN KEY (question_id) REFERENCES dbo.questions(question_id)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_aa_question')
  CREATE INDEX IX_aa_question ON dbo.attempt_answers (question_id);
GO
