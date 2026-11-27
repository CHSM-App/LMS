-- 004_operations: demo requests, enrollments + access periods, live classes, attendance, doubts, class programs.

IF OBJECT_ID('dbo.demo_requests') IS NULL
CREATE TABLE dbo.demo_requests (
  demo_request_id  INT IDENTITY(1,1) NOT NULL,
  course_id        INT            NOT NULL,
  teacher_id       INT            NOT NULL,
  name             NVARCHAR(120)  NOT NULL,
  mobile           VARCHAR(20)    NOT NULL,
  education        NVARCHAR(120)  NOT NULL,
  class_standard   NVARCHAR(40)   NULL,
  preferred_time   NVARCHAR(80)   NULL,
  message          NVARCHAR(1000) NULL,
  whatsapp_opt_in  BIT            NOT NULL CONSTRAINT DF_demo_wa DEFAULT 0,
  status           VARCHAR(10)    NOT NULL CONSTRAINT DF_demo_status DEFAULT 'pending'
                   CONSTRAINT CK_demo_status CHECK (status IN ('pending','scheduled','completed','rejected')),
  scheduled_at     DATETIME2(3)   NULL,
  meet_link        VARCHAR(300)   NULL,
  whatsapp_sent_at DATETIME2(3)   NULL,
  whatsapp_error   NVARCHAR(300)  NULL,
  created_at       DATETIME2(3)   NOT NULL CONSTRAINT DF_demo_created DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_demo_requests PRIMARY KEY CLUSTERED (demo_request_id),
  CONSTRAINT FK_demo_course FOREIGN KEY (course_id) REFERENCES dbo.courses(course_id),
  CONSTRAINT FK_demo_teacher FOREIGN KEY (teacher_id) REFERENCES dbo.users(user_id)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_demo_teacher_status')
  CREATE INDEX IX_demo_teacher_status ON dbo.demo_requests (teacher_id, status, created_at DESC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_demo_course')
  CREATE INDEX IX_demo_course ON dbo.demo_requests (course_id, mobile);
GO

IF OBJECT_ID('dbo.enrollments') IS NULL
CREATE TABLE dbo.enrollments (
  enrollment_id INT IDENTITY(1,1) NOT NULL,
  student_id    INT            NOT NULL,
  course_id     INT            NOT NULL,
  teacher_id    INT            NOT NULL,
  batch_id      INT            NULL,
  status        VARCHAR(10)    NOT NULL CONSTRAINT DF_enroll_status DEFAULT 'pending'
                CONSTRAINT CK_enroll_status CHECK (status IN ('pending','approved','rejected','blocked')),
  message       NVARCHAR(1000) NULL,
  reject_reason NVARCHAR(500)  NULL,
  requested_at  DATETIME2(3)   NOT NULL CONSTRAINT DF_enroll_requested DEFAULT SYSUTCDATETIME(),
  decided_at    DATETIME2(3)   NULL,
  CONSTRAINT PK_enrollments PRIMARY KEY CLUSTERED (enrollment_id),
  CONSTRAINT UQ_enrollments_student_course UNIQUE (student_id, course_id),
  CONSTRAINT FK_enroll_student FOREIGN KEY (student_id) REFERENCES dbo.users(user_id),
  CONSTRAINT FK_enroll_course FOREIGN KEY (course_id) REFERENCES dbo.courses(course_id),
  CONSTRAINT FK_enroll_teacher FOREIGN KEY (teacher_id) REFERENCES dbo.users(user_id),
  CONSTRAINT FK_enroll_batch FOREIGN KEY (batch_id) REFERENCES dbo.batches(batch_id)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_enroll_teacher_status')
  CREATE INDEX IX_enroll_teacher_status ON dbo.enrollments (teacher_id, status) INCLUDE (course_id, batch_id, student_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_enroll_course')
  CREATE INDEX IX_enroll_course ON dbo.enrollments (course_id, status);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_enroll_batch')
  CREATE INDEX IX_enroll_batch ON dbo.enrollments (batch_id);
GO

IF OBJECT_ID('dbo.student_subscriptions') IS NULL
CREATE TABLE dbo.student_subscriptions (
  student_subscription_id INT IDENTITY(1,1) NOT NULL,
  enrollment_id           INT  NOT NULL,
  start_date              DATE NOT NULL,
  end_date                DATE NOT NULL,
  access_enabled          BIT  NOT NULL CONSTRAINT DF_ssub_access DEFAULT 1,
  CONSTRAINT PK_student_subscriptions PRIMARY KEY CLUSTERED (student_subscription_id),
  CONSTRAINT UQ_ssub_enrollment UNIQUE (enrollment_id),
  CONSTRAINT FK_ssub_enrollment FOREIGN KEY (enrollment_id) REFERENCES dbo.enrollments(enrollment_id),
  CONSTRAINT CK_ssub_dates CHECK (end_date >= start_date)
);
GO

IF OBJECT_ID('dbo.live_classes') IS NULL
CREATE TABLE dbo.live_classes (
  live_class_id    INT IDENTITY(1,1) NOT NULL,
  course_id        INT           NOT NULL,
  batch_id         INT           NULL,
  topic            NVARCHAR(200) NOT NULL,
  starts_at        DATETIME2(3)  NOT NULL,
  duration_min     INT           NOT NULL CONSTRAINT DF_lc_duration DEFAULT 60 CONSTRAINT CK_lc_duration CHECK (duration_min BETWEEN 5 AND 600),
  meet_link        VARCHAR(300)  NOT NULL,
  status           VARCHAR(10)   NOT NULL CONSTRAINT DF_lc_status DEFAULT 'scheduled'
                   CONSTRAINT CK_lc_status CHECK (status IN ('scheduled','live','completed','cancelled')),
  reminder_sent_at DATETIME2(3)  NULL,
  created_at       DATETIME2(3)  NOT NULL CONSTRAINT DF_lc_created DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_live_classes PRIMARY KEY CLUSTERED (live_class_id),
  CONSTRAINT FK_lc_course FOREIGN KEY (course_id) REFERENCES dbo.courses(course_id),
  CONSTRAINT FK_lc_batch FOREIGN KEY (batch_id) REFERENCES dbo.batches(batch_id)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_lc_course_start')
  CREATE INDEX IX_lc_course_start ON dbo.live_classes (course_id, starts_at);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_lc_batch')
  CREATE INDEX IX_lc_batch ON dbo.live_classes (batch_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_lc_reminder')
  CREATE INDEX IX_lc_reminder ON dbo.live_classes (starts_at) WHERE reminder_sent_at IS NULL AND status = 'scheduled';
GO

IF OBJECT_ID('dbo.attendance') IS NULL
CREATE TABLE dbo.attendance (
  live_class_id INT          NOT NULL,
  student_id    INT          NOT NULL,
  present       BIT          NOT NULL,
  marked_at     DATETIME2(3) NOT NULL CONSTRAINT DF_att_marked DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_attendance PRIMARY KEY CLUSTERED (live_class_id, student_id),
  CONSTRAINT FK_att_class FOREIGN KEY (live_class_id) REFERENCES dbo.live_classes(live_class_id),
  CONSTRAINT FK_att_student FOREIGN KEY (student_id) REFERENCES dbo.users(user_id)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_att_student')
  CREATE INDEX IX_att_student ON dbo.attendance (student_id);
GO

IF OBJECT_ID('dbo.doubts') IS NULL
CREATE TABLE dbo.doubts (
  doubt_id       INT IDENTITY(1,1) NOT NULL,
  student_id     INT            NOT NULL,
  course_id      INT            NOT NULL,
  question       NVARCHAR(2000) NOT NULL,
  attachment_key VARCHAR(200)   NULL,
  reply          NVARCHAR(2000) NULL,
  replied_at     DATETIME2(3)   NULL,
  status         VARCHAR(8)     NOT NULL CONSTRAINT DF_doubts_status DEFAULT 'open'
                 CONSTRAINT CK_doubts_status CHECK (status IN ('open','answered','closed')),
  created_at     DATETIME2(3)   NOT NULL CONSTRAINT DF_doubts_created DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_doubts PRIMARY KEY CLUSTERED (doubt_id),
  CONSTRAINT FK_doubts_student FOREIGN KEY (student_id) REFERENCES dbo.users(user_id),
  CONSTRAINT FK_doubts_course FOREIGN KEY (course_id) REFERENCES dbo.courses(course_id)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_doubts_course_status')
  CREATE INDEX IX_doubts_course_status ON dbo.doubts (course_id, status, created_at DESC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_doubts_student')
  CREATE INDEX IX_doubts_student ON dbo.doubts (student_id);
GO

IF OBJECT_ID('dbo.class_programs') IS NULL
CREATE TABLE dbo.class_programs (
  program_id INT IDENTITY(1,1) NOT NULL,
  teacher_id INT           NOT NULL,
  course_id  INT           NULL,
  batch_id   INT           NULL,
  title      NVARCHAR(200) NOT NULL,
  starts_at  DATETIME2(3)  NOT NULL,
  created_at DATETIME2(3)  NOT NULL CONSTRAINT DF_prog_created DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_class_programs PRIMARY KEY CLUSTERED (program_id),
  CONSTRAINT FK_prog_teacher FOREIGN KEY (teacher_id) REFERENCES dbo.users(user_id),
  CONSTRAINT FK_prog_course FOREIGN KEY (course_id) REFERENCES dbo.courses(course_id),
  CONSTRAINT FK_prog_batch FOREIGN KEY (batch_id) REFERENCES dbo.batches(batch_id)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_prog_teacher')
  CREATE INDEX IX_prog_teacher ON dbo.class_programs (teacher_id, starts_at);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_prog_course')
  CREATE INDEX IX_prog_course ON dbo.class_programs (course_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_prog_batch')
  CREATE INDEX IX_prog_batch ON dbo.class_programs (batch_id);
GO
