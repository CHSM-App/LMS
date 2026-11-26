-- 012_push_tokens: one row per phone/browser that can receive a push (Firebase Cloud Messaging).
IF OBJECT_ID('dbo.push_tokens') IS NULL
CREATE TABLE dbo.push_tokens (
  push_token_id INT IDENTITY(1,1) NOT NULL,
  user_id       INT           NOT NULL,
  token         VARCHAR(512)  NOT NULL,
  platform      VARCHAR(10)   NOT NULL,
  created_at    DATETIME2(3)  NOT NULL CONSTRAINT DF_push_tokens_created DEFAULT SYSUTCDATETIME(),
  updated_at    DATETIME2(3)  NOT NULL CONSTRAINT DF_push_tokens_updated DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_push_tokens PRIMARY KEY CLUSTERED (push_token_id),
  CONSTRAINT UQ_push_tokens_token UNIQUE (token),
  CONSTRAINT FK_push_tokens_user FOREIGN KEY (user_id) REFERENCES dbo.users(user_id),
  CONSTRAINT CK_push_tokens_platform CHECK (platform IN ('android', 'ios', 'web'))
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_push_tokens_user')
  CREATE INDEX IX_push_tokens_user ON dbo.push_tokens (user_id);
GO
