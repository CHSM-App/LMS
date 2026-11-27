-- 002_content: courses, subjects, modules, contents, batches, upload sessions.

IF OBJECT_ID('dbo.upload_sessions') IS NULL
CREATE TABLE dbo.upload_sessions (
  upload_id      UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_upload_id DEFAULT NEWID(),
  teacher_id     INT            NOT NULL,
  kind           VARCHAR(20)    NOT NULL CONSTRAINT CK_upload_kind CHECK (kind IN ('thumbnail','photo','pdf','video','demo_video')),
  file_name      NVARCHAR(200)  NOT NULL,
  total_bytes    BIGINT         NOT NULL,
  received_bytes BIGINT         NOT NULL CONSTRAINT DF_upload_received DEFAULT 0,
  status         VARCHAR(10)    NOT NULL CONSTRAINT DF_upload_status DEFAULT 'open'
                 CONSTRAINT CK_upload_status CHECK (status IN ('open','complete','aborted')),
  file_key       VARCHAR(200)   NULL,
  created_at     DATETIME2(3)   NOT NULL CONSTRAINT DF_upload_created DEFAULT SYSUTCDATETIME(),
  expires_at     DATETIME2(3)   NOT NULL,
  CONSTRAINT PK_upload_sessions PRIMARY KEY NONCLUSTERED (upload_id),
  CONSTRAINT FK_upload_teacher FOREIGN KEY (teacher_id) REFERENCES dbo.users(user_id)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_upload_teacher_key')
  CREATE INDEX IX_upload_teacher_key ON dbo.upload_sessions (teacher_id, file_key);
GO

IF OBJECT_ID('dbo.courses') IS NULL
CREATE TABLE dbo.courses (
  course_id          INT IDENTITY(1,1) NOT NULL,
  public_id          UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_courses_public DEFAULT NEWID(),
  teacher_id         INT            NOT NULL,
  title              NVARCHAR(200)  NOT NULL,
  slug               VARCHAR(220)   NOT NULL,
  description        NVARCHAR(MAX)  NOT NULL,
  subject            NVARCHAR(120)  NOT NULL,
  language           VARCHAR(5)     NOT NULL,
  thumbnail_key      VARCHAR(200)   NULL,
  duration_text      NVARCHAR(60)   NULL,
  fee_display        NVARCHAR(60)   NULL,
  demo1_source       VARCHAR(8)     NULL CONSTRAINT CK_courses_demo1 CHECK (demo1_source IN ('upload','youtube','vimeo','bunny')),
  demo1_ref          VARCHAR(500)   NULL,
  demo2_source       VARCHAR(8)     NULL CONSTRAINT CK_courses_demo2 CHECK (demo2_source IN ('upload','youtube','vimeo','bunny')),
  demo2_ref          VARCHAR(500)   NULL,
  status             VARCHAR(10)    NOT NULL CONSTRAINT DF_courses_status DEFAULT 'draft'
                     CONSTRAINT CK_courses_status CHECK (status IN ('draft','pending','published')),
  published_at       DATETIME2(3)   NULL,
  created_at         DATETIME2(3)   NOT NULL CONSTRAINT DF_courses_created DEFAULT SYSUTCDATETIME(),
  updated_at         DATETIME2(3)   NOT NULL CONSTRAINT DF_courses_updated DEFAULT SYSUTCDATETIME(),
  row_ver            ROWVERSION,
  CONSTRAINT PK_courses PRIMARY KEY CLUSTERED (course_id),
  CONSTRAINT UQ_courses_public UNIQUE (public_id),
  CONSTRAINT UQ_courses_slug UNIQUE (slug),
  CONSTRAINT FK_courses_teacher FOREIGN KEY (teacher_id) REFERENCES dbo.users(user_id)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_courses_teacher_status')
  CREATE INDEX IX_courses_teacher_status ON dbo.courses (teacher_id, status) INCLUDE (title, updated_at);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_courses_published')
  CREATE INDEX IX_courses_published ON dbo.courses (status, published_at DESC) WHERE status = 'published';
GO

IF OBJECT_ID('dbo.subjects') IS NULL
CREATE TABLE dbo.subjects (
  subject_id  INT IDENTITY(1,1) NOT NULL,
  course_id   INT            NOT NULL,
  name        NVARCHAR(120)  NOT NULL,
  description NVARCHAR(1000) NULL,
  sort_order  INT            NOT NULL,
  CONSTRAINT PK_subjects PRIMARY KEY CLUSTERED (subject_id),
  CONSTRAINT FK_subjects_course FOREIGN KEY (course_id) REFERENCES dbo.courses(course_id)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_subjects_course')
  CREATE INDEX IX_subjects_course ON dbo.subjects (course_id, sort_order);
GO

IF OBJECT_ID('dbo.modules') IS NULL
CREATE TABLE dbo.modules (
  module_id  INT IDENTITY(1,1) NOT NULL,
  subject_id INT           NOT NULL,
  course_id  INT           NOT NULL,
  name       NVARCHAR(160) NOT NULL,
  sort_order INT           NOT NULL,
  CONSTRAINT PK_modules PRIMARY KEY CLUSTERED (module_id),
  CONSTRAINT FK_modules_subject FOREIGN KEY (subject_id) REFERENCES dbo.subjects(subject_id),
  CONSTRAINT FK_modules_course FOREIGN KEY (course_id) REFERENCES dbo.courses(course_id),
  CONSTRAINT UQ_modules_order UNIQUE (subject_id, sort_order)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_modules_course')
  CREATE INDEX IX_modules_course ON dbo.modules (course_id);
GO

IF OBJECT_ID('dbo.contents') IS NULL
CREATE TABLE dbo.contents (
  content_id      INT IDENTITY(1,1) NOT NULL,
  module_id       INT           NOT NULL,
  course_id       INT           NOT NULL,
  title           NVARCHAR(200) NOT NULL,
  type            VARCHAR(5)    NOT NULL CONSTRAINT CK_contents_type CHECK (type IN ('video','pdf','link')),
  video_source    VARCHAR(8)    NULL CONSTRAINT CK_contents_vsource CHECK (video_source IN ('upload','youtube','vimeo','bunny')),
  file_key        VARCHAR(200)  NULL,
  url             VARCHAR(500)  NULL,
  sort_order      INT           NOT NULL,
  is_free_preview BIT           NOT NULL CONSTRAINT DF_contents_preview DEFAULT 0,
  created_at      DATETIME2(3)  NOT NULL CONSTRAINT DF_contents_created DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_contents PRIMARY KEY CLUSTERED (content_id),
  CONSTRAINT FK_contents_module FOREIGN KEY (module_id) REFERENCES dbo.modules(module_id),
  CONSTRAINT FK_contents_course FOREIGN KEY (course_id) REFERENCES dbo.courses(course_id),
  CONSTRAINT UQ_contents_order UNIQUE (module_id, sort_order),
  CONSTRAINT CK_contents_source CHECK (
    (type = 'link' AND url IS NOT NULL) OR
    (type = 'pdf' AND file_key IS NOT NULL) OR
    (type = 'video' AND ((video_source = 'upload' AND file_key IS NOT NULL) OR (video_source <> 'upload' AND url IS NOT NULL)))
  )
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_contents_course')
  CREATE INDEX IX_contents_course ON dbo.contents (course_id);
GO

IF OBJECT_ID('dbo.batches') IS NULL
CREATE TABLE dbo.batches (
  batch_id     INT IDENTITY(1,1) NOT NULL,
  course_id    INT           NOT NULL,
  name         NVARCHAR(80)  NOT NULL,
  start_date   DATE          NOT NULL,
  end_date     DATE          NULL,
  timing_text  NVARCHAR(80)  NULL,
  max_students INT           NULL,
  status       VARCHAR(8)    NOT NULL CONSTRAINT DF_batches_status DEFAULT 'active'
               CONSTRAINT CK_batches_status CHECK (status IN ('active','closed')),
  created_at   DATETIME2(3)  NOT NULL CONSTRAINT DF_batches_created DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_batches PRIMARY KEY CLUSTERED (batch_id),
  CONSTRAINT FK_batches_course FOREIGN KEY (course_id) REFERENCES dbo.courses(course_id),
  CONSTRAINT UQ_batches_name UNIQUE (course_id, name),
  CONSTRAINT CK_batches_dates CHECK (end_date IS NULL OR end_date >= start_date),
  CONSTRAINT CK_batches_max CHECK (max_students IS NULL OR max_students > 0)
);
GO
