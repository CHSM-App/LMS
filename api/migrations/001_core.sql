-- 001_core: users, profiles, onboarding, subscriptions, auth, notifications, audit, consent.
-- Idempotent: every object is guarded. Times are UTC (SYSUTCDATETIME). Constraints are named.

IF OBJECT_ID('dbo.users') IS NULL
CREATE TABLE dbo.users (
  user_id         INT IDENTITY(1,1) NOT NULL,
  public_id       UNIQUEIDENTIFIER  NOT NULL CONSTRAINT DF_users_public_id DEFAULT NEWID(),
  mobile          VARCHAR(20)       NOT NULL,
  name            NVARCHAR(120)     NOT NULL,
  email           VARCHAR(160)      NULL,
  city            NVARCHAR(80)      NULL,
  photo_key       VARCHAR(200)      NULL,
  role            VARCHAR(10)       NOT NULL CONSTRAINT CK_users_role CHECK (role IN ('admin','teacher','student')),
  status          VARCHAR(10)       NOT NULL CONSTRAINT CK_users_status CHECK (status IN ('pending','approved','rejected','blocked')),
  preferred_lang  CHAR(2)           NOT NULL CONSTRAINT DF_users_lang DEFAULT 'en',
  whatsapp_opt_in BIT               NOT NULL CONSTRAINT DF_users_wa DEFAULT 0,
  deleted_at      DATETIME2(3)      NULL,
  created_at      DATETIME2(3)      NOT NULL CONSTRAINT DF_users_created DEFAULT SYSUTCDATETIME(),
  updated_at      DATETIME2(3)      NOT NULL CONSTRAINT DF_users_updated DEFAULT SYSUTCDATETIME(),
  row_ver         ROWVERSION,
  CONSTRAINT PK_users PRIMARY KEY CLUSTERED (user_id),
  CONSTRAINT UQ_users_public_id UNIQUE (public_id)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_users_mobile_active')
  CREATE UNIQUE INDEX UX_users_mobile_active ON dbo.users (mobile) WHERE deleted_at IS NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_users_role_status_created')
  CREATE INDEX IX_users_role_status_created ON dbo.users (role, status, created_at DESC) INCLUDE (name, mobile);
GO

IF OBJECT_ID('dbo.teacher_profiles') IS NULL
CREATE TABLE dbo.teacher_profiles (
  user_id           INT            NOT NULL,
  subject           NVARCHAR(120)  NULL,
  experience_years  TINYINT        NULL,
  qualification     NVARCHAR(160)  NULL,
  bio               NVARCHAR(2000) NULL,
  intro_video_url   VARCHAR(500)   NULL,
  social_links_json NVARCHAR(1000) NULL,
  languages         NVARCHAR(200)  NULL,
  public_slug       VARCHAR(80)    NULL,
  CONSTRAINT PK_teacher_profiles PRIMARY KEY CLUSTERED (user_id),
  CONSTRAINT FK_teacher_profiles_user FOREIGN KEY (user_id) REFERENCES dbo.users(user_id)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_teacher_profiles_slug')
  CREATE UNIQUE INDEX UX_teacher_profiles_slug ON dbo.teacher_profiles (public_slug) WHERE public_slug IS NOT NULL;
GO

IF OBJECT_ID('dbo.student_profiles') IS NULL
CREATE TABLE dbo.student_profiles (
  user_id        INT           NOT NULL,
  education      NVARCHAR(120) NULL,
  class_standard NVARCHAR(40)  NULL,
  CONSTRAINT PK_student_profiles PRIMARY KEY CLUSTERED (user_id),
  CONSTRAINT FK_student_profiles_user FOREIGN KEY (user_id) REFERENCES dbo.users(user_id)
);
GO

IF OBJECT_ID('dbo.teacher_requests') IS NULL
CREATE TABLE dbo.teacher_requests (
  request_id       INT IDENTITY(1,1) NOT NULL,
  mobile           VARCHAR(20)    NOT NULL,
  name             NVARCHAR(120)  NOT NULL,
  course_name      NVARCHAR(200)  NOT NULL,
  subject          NVARCHAR(120)  NOT NULL,
  experience_years TINYINT        NOT NULL,
  email            VARCHAR(160)   NULL,
  city             NVARCHAR(80)   NULL,
  qualification    NVARCHAR(160)  NULL,
  photo_key        VARCHAR(200)   NULL,
  id_document_key  VARCHAR(200)   NULL,
  status           VARCHAR(10)    NOT NULL CONSTRAINT DF_teacher_requests_status DEFAULT 'pending'
                   CONSTRAINT CK_teacher_requests_status CHECK (status IN ('pending','approved','rejected')),
  reject_reason    NVARCHAR(500)  NULL,
  reviewed_by      INT            NULL,
  reviewed_at      DATETIME2(3)   NULL,
  user_id          INT            NULL,
  created_at       DATETIME2(3)   NOT NULL CONSTRAINT DF_teacher_requests_created DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_teacher_requests PRIMARY KEY CLUSTERED (request_id),
  CONSTRAINT FK_teacher_requests_reviewer FOREIGN KEY (reviewed_by) REFERENCES dbo.users(user_id),
  CONSTRAINT FK_teacher_requests_user FOREIGN KEY (user_id) REFERENCES dbo.users(user_id)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_teacher_requests_pending_mobile')
  CREATE UNIQUE INDEX UX_teacher_requests_pending_mobile ON dbo.teacher_requests (mobile) WHERE status = 'pending';
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_teacher_requests_status_created')
  CREATE INDEX IX_teacher_requests_status_created ON dbo.teacher_requests (status, created_at DESC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_teacher_requests_reviewed_by')
  CREATE INDEX IX_teacher_requests_reviewed_by ON dbo.teacher_requests (reviewed_by);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_teacher_requests_user')
  CREATE INDEX IX_teacher_requests_user ON dbo.teacher_requests (user_id);
GO

IF OBJECT_ID('dbo.teacher_subscriptions') IS NULL
CREATE TABLE dbo.teacher_subscriptions (
  subscription_id  INT IDENTITY(1,1) NOT NULL,
  teacher_id       INT          NOT NULL,
  plan_type        VARCHAR(12)  NOT NULL CONSTRAINT CK_teacher_subs_plan CHECK (plan_type IN ('monthly','quarterly','half_yearly','yearly','custom')),
  start_date       DATE         NOT NULL,
  end_date         DATE         NOT NULL,
  is_blocked       BIT          NOT NULL CONSTRAINT DF_teacher_subs_blocked DEFAULT 0,
  reminder_sent_at DATETIME2(3) NULL,
  created_by       INT          NULL,
  created_at       DATETIME2(3) NOT NULL CONSTRAINT DF_teacher_subs_created DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_teacher_subscriptions PRIMARY KEY CLUSTERED (subscription_id),
  CONSTRAINT FK_teacher_subs_teacher FOREIGN KEY (teacher_id) REFERENCES dbo.users(user_id),
  CONSTRAINT FK_teacher_subs_creator FOREIGN KEY (created_by) REFERENCES dbo.users(user_id),
  CONSTRAINT CK_teacher_subs_dates CHECK (end_date >= start_date)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_teacher_subs_teacher_dates')
  CREATE INDEX IX_teacher_subs_teacher_dates ON dbo.teacher_subscriptions (teacher_id, start_date, end_date);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_teacher_subs_creator')
  CREATE INDEX IX_teacher_subs_creator ON dbo.teacher_subscriptions (created_by);
GO

IF OBJECT_ID('dbo.otp_codes') IS NULL
CREATE TABLE dbo.otp_codes (
  otp_id            INT IDENTITY(1,1) NOT NULL,
  mobile            VARCHAR(20)    NOT NULL,
  purpose           VARCHAR(20)    NOT NULL CONSTRAINT CK_otp_purpose CHECK (purpose IN ('login','teacher_register','student_register','demo_request','change_mobile','delete_account')),
  code_hash         VARBINARY(32)  NOT NULL,
  expires_at        DATETIME2(3)   NOT NULL,
  attempts          TINYINT        NOT NULL CONSTRAINT DF_otp_attempts DEFAULT 0,
  resend_count      TINYINT        NOT NULL CONSTRAINT DF_otp_resend DEFAULT 1,
  window_started_at DATETIME2(3)   NOT NULL,
  consumed_at       DATETIME2(3)   NULL,
  created_at        DATETIME2(3)   NOT NULL CONSTRAINT DF_otp_created DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_otp_codes PRIMARY KEY CLUSTERED (otp_id)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_otp_mobile_purpose')
  CREATE INDEX IX_otp_mobile_purpose ON dbo.otp_codes (mobile, purpose, created_at DESC);
GO

IF OBJECT_ID('dbo.refresh_tokens') IS NULL
CREATE TABLE dbo.refresh_tokens (
  token_id    INT IDENTITY(1,1) NOT NULL,
  user_id     INT              NOT NULL,
  family_id   UNIQUEIDENTIFIER NOT NULL,
  token_hash  VARBINARY(32)    NOT NULL,
  device_id   VARCHAR(64)      NULL,
  expires_at  DATETIME2(3)     NOT NULL,
  revoked_at  DATETIME2(3)     NULL,
  replaced_by INT              NULL,
  created_at  DATETIME2(3)     NOT NULL CONSTRAINT DF_refresh_created DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_refresh_tokens PRIMARY KEY CLUSTERED (token_id),
  CONSTRAINT UQ_refresh_tokens_hash UNIQUE (token_hash),
  CONSTRAINT FK_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES dbo.users(user_id)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_refresh_tokens_user')
  CREATE INDEX IX_refresh_tokens_user ON dbo.refresh_tokens (user_id, revoked_at);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_refresh_tokens_family')
  CREATE INDEX IX_refresh_tokens_family ON dbo.refresh_tokens (family_id);
GO

IF OBJECT_ID('dbo.notifications') IS NULL
CREATE TABLE dbo.notifications (
  notification_id INT IDENTITY(1,1) NOT NULL,
  user_id         INT            NOT NULL,
  title           NVARCHAR(160)  NOT NULL,
  message         NVARCHAR(1000) NOT NULL,
  link            VARCHAR(300)   NULL,
  is_read         BIT            NOT NULL CONSTRAINT DF_notifications_read DEFAULT 0,
  created_at      DATETIME2(3)   NOT NULL CONSTRAINT DF_notifications_created DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_notifications PRIMARY KEY CLUSTERED (notification_id),
  CONSTRAINT FK_notifications_user FOREIGN KEY (user_id) REFERENCES dbo.users(user_id)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_notifications_user')
  CREATE INDEX IX_notifications_user ON dbo.notifications (user_id, is_read, created_at DESC);
GO

IF OBJECT_ID('dbo.admin_audit_log') IS NULL
CREATE TABLE dbo.admin_audit_log (
  audit_id    BIGINT IDENTITY(1,1) NOT NULL,
  admin_id    INT           NOT NULL,
  action      VARCHAR(40)   NOT NULL,
  entity_type VARCHAR(30)   NOT NULL,
  entity_id   INT           NULL,
  before_json NVARCHAR(MAX) NULL,
  after_json  NVARCHAR(MAX) NULL,
  ip          VARCHAR(45)   NULL,
  created_at  DATETIME2(3)  NOT NULL CONSTRAINT DF_audit_created DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_admin_audit_log PRIMARY KEY CLUSTERED (audit_id),
  CONSTRAINT FK_audit_admin FOREIGN KEY (admin_id) REFERENCES dbo.users(user_id)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_audit_admin')
  CREATE INDEX IX_audit_admin ON dbo.admin_audit_log (admin_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_audit_action_created')
  CREATE INDEX IX_audit_action_created ON dbo.admin_audit_log (action, created_at DESC);
GO

IF OBJECT_ID('dbo.legal_consents') IS NULL
CREATE TABLE dbo.legal_consents (
  consent_id     INT IDENTITY(1,1) NOT NULL,
  user_id        INT          NULL,
  mobile         VARCHAR(20)  NOT NULL,
  consent_type   VARCHAR(20)  NOT NULL CONSTRAINT CK_consent_type CHECK (consent_type IN ('terms_privacy','whatsapp')),
  policy_version VARCHAR(10)  NOT NULL,
  ip             VARCHAR(45)  NULL,
  consented_at   DATETIME2(3) NOT NULL CONSTRAINT DF_consent_at DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_legal_consents PRIMARY KEY CLUSTERED (consent_id),
  CONSTRAINT FK_consent_user FOREIGN KEY (user_id) REFERENCES dbo.users(user_id)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_consent_user')
  CREATE INDEX IX_consent_user ON dbo.legal_consents (user_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_consent_mobile')
  CREATE INDEX IX_consent_mobile ON dbo.legal_consents (mobile);
GO

IF OBJECT_ID('dbo.mobile_change_requests') IS NULL
CREATE TABLE dbo.mobile_change_requests (
  request_id   INT IDENTITY(1,1) NOT NULL,
  user_id      INT          NOT NULL,
  old_mobile   VARCHAR(20)  NOT NULL,
  new_mobile   VARCHAR(20)  NOT NULL,
  status       VARCHAR(10)  NOT NULL CONSTRAINT CK_mcr_status CHECK (status IN ('pending','completed','cancelled')),
  changed_by   INT          NULL,
  reason       NVARCHAR(300) NULL,
  created_at   DATETIME2(3) NOT NULL CONSTRAINT DF_mcr_created DEFAULT SYSUTCDATETIME(),
  completed_at DATETIME2(3) NULL,
  CONSTRAINT PK_mobile_change_requests PRIMARY KEY CLUSTERED (request_id),
  CONSTRAINT FK_mcr_user FOREIGN KEY (user_id) REFERENCES dbo.users(user_id),
  CONSTRAINT FK_mcr_changed_by FOREIGN KEY (changed_by) REFERENCES dbo.users(user_id)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_mcr_user')
  CREATE INDEX IX_mcr_user ON dbo.mobile_change_requests (user_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_mcr_changed_by')
  CREATE INDEX IX_mcr_changed_by ON dbo.mobile_change_requests (changed_by);
GO
