-- 005_student: lesson progress, registered devices, offline download licences.

IF OBJECT_ID('dbo.content_progress') IS NULL
CREATE TABLE dbo.content_progress (
  student_id        INT          NOT NULL,
  content_id        INT          NOT NULL,
  last_position_sec INT          NOT NULL CONSTRAINT DF_cp_pos DEFAULT 0,
  completed_at      DATETIME2(3) NULL,
  updated_at        DATETIME2(3) NOT NULL CONSTRAINT DF_cp_updated DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_content_progress PRIMARY KEY CLUSTERED (student_id, content_id),
  CONSTRAINT FK_cp_student FOREIGN KEY (student_id) REFERENCES dbo.users(user_id),
  CONSTRAINT FK_cp_content FOREIGN KEY (content_id) REFERENCES dbo.contents(content_id)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_cp_content')
  CREATE INDEX IX_cp_content ON dbo.content_progress (content_id);
GO

IF OBJECT_ID('dbo.student_devices') IS NULL
CREATE TABLE dbo.student_devices (
  device_id     VARCHAR(64)   NOT NULL,
  student_id    INT           NOT NULL,
  device_name   NVARCHAR(80)  NULL,
  platform      VARCHAR(10)   NULL,
  registered_at DATETIME2(3)  NOT NULL CONSTRAINT DF_sd_registered DEFAULT SYSUTCDATETIME(),
  removed_at    DATETIME2(3)  NULL,
  CONSTRAINT PK_student_devices PRIMARY KEY CLUSTERED (student_id, device_id),
  CONSTRAINT FK_sd_student FOREIGN KEY (student_id) REFERENCES dbo.users(user_id)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_sd_active')
  CREATE INDEX IX_sd_active ON dbo.student_devices (student_id) WHERE removed_at IS NULL;
GO

IF OBJECT_ID('dbo.offline_downloads') IS NULL
CREATE TABLE dbo.offline_downloads (
  download_id        INT IDENTITY(1,1) NOT NULL,
  student_id         INT              NOT NULL,
  content_id         INT              NOT NULL,
  device_id          VARCHAR(64)      NOT NULL,
  key_id             UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_od_key DEFAULT NEWID(),
  license_expires_at DATETIME2(3)     NOT NULL,
  last_renewed_at    DATETIME2(3)     NOT NULL CONSTRAINT DF_od_renewed DEFAULT SYSUTCDATETIME(),
  revoked_at         DATETIME2(3)     NULL,
  revoke_reason      VARCHAR(30)      NULL,
  created_at         DATETIME2(3)     NOT NULL CONSTRAINT DF_od_created DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_offline_downloads PRIMARY KEY CLUSTERED (download_id),
  CONSTRAINT UQ_od_student_content_device UNIQUE (student_id, content_id, device_id),
  CONSTRAINT FK_od_student FOREIGN KEY (student_id) REFERENCES dbo.users(user_id),
  CONSTRAINT FK_od_content FOREIGN KEY (content_id) REFERENCES dbo.contents(content_id)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_od_content')
  CREATE INDEX IX_od_content ON dbo.offline_downloads (content_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_od_device')
  CREATE INDEX IX_od_device ON dbo.offline_downloads (student_id, device_id) WHERE revoked_at IS NULL;
GO
