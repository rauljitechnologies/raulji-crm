#!/bin/bash
SCHEMA="/var/application/raulji-crm/prisma/schema.prisma"

cat >> $SCHEMA << 'MODELS'

// ── AutoReplyRule ─────────────────────────────────────────────
model AutoReplyRule {
  id          String   @id @default(cuid())
  companyId   String   @map("company_id")
  name        String
  trigger     String
  channel     String   @default("whatsapp")
  message     String
  isActive    Boolean  @default(true) @map("is_active")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  company Company @relation(fields: [companyId], references: [companyId])

  @@map("auto_reply_rules")
}

// ── AutomationRule ────────────────────────────────────────────
model AutomationRule {
  id          String   @id @default(cuid())
  companyId   String   @map("company_id")
  name        String
  trigger     String
  channel     String   @default("email")
  conditions  Json     @default("{}")
  actions     Json     @default("{}")
  isActive    Boolean  @default(true) @map("is_active")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  company Company        @relation(fields: [companyId], references: [companyId])
  jobs    AutomationJob[]

  @@map("automation_rules")
}

// ── AutomationJob ─────────────────────────────────────────────
model AutomationJob {
  jobId       String   @id @default(cuid()) @map("job_id")
  companyId   String   @map("company_id")
  ruleId      String?  @map("rule_id")
  status      String   @default("PENDING")
  payload     Json     @default("{}")
  result      Json?
  error       String?
  attempts    Int      @default(0)
  runAt       DateTime @default(now()) @map("run_at")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  company Company         @relation(fields: [companyId], references: [companyId])
  rule    AutomationRule? @relation(fields: [ruleId], references: [id])

  @@map("automation_jobs")
}

// ── BackupLog ─────────────────────────────────────────────────
model BackupLog {
  id          String   @id @default(cuid())
  companyId   String?  @map("company_id")
  type        String   @default("full")
  status      String   @default("SUCCESS")
  size        String?
  path        String?
  error       String?
  createdAt   DateTime @default(now()) @map("created_at")

  @@map("backup_logs")
}

// ── Campaign ──────────────────────────────────────────────────
model Campaign {
  id          String   @id @default(cuid())
  companyId   String   @map("company_id")
  name        String
  type        String   @default("email")
  status      String   @default("DRAFT")
  subject     String?
  message     String?
  scheduledAt DateTime? @map("scheduled_at")
  sentAt      DateTime? @map("sent_at")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  company Company        @relation(fields: [companyId], references: [companyId])
  leads   CampaignLead[]

  @@map("campaigns")
}

// ── CampaignLead ──────────────────────────────────────────────
model CampaignLead {
  id         String   @id @default(cuid())
  campaignId String   @map("campaign_id")
  leadId     String   @map("lead_id")
  status     String   @default("PENDING")
  sentAt     DateTime? @map("sent_at")
  createdAt  DateTime @default(now()) @map("created_at")

  campaign Campaign @relation(fields: [campaignId], references: [id])
  lead     Lead     @relation(fields: [leadId], references: [leadId])

  @@unique([campaignId, leadId])
  @@map("campaign_leads")
}

// ── Communication ─────────────────────────────────────────────
model Communication {
  id          String   @id @default(cuid())
  companyId   String   @map("company_id")
  leadId      String?  @map("lead_id")
  type        String   @default("email")
  direction   String   @default("outbound")
  subject     String?
  message     String?
  status      String   @default("SENT")
  metadata    Json?
  createdAt   DateTime @default(now()) @map("created_at")

  company Company @relation(fields: [companyId], references: [companyId])
  lead    Lead?   @relation(fields: [leadId], references: [leadId])

  @@map("communications")
}

// ── MessageTemplate ───────────────────────────────────────────
model MessageTemplate {
  id          String   @id @default(cuid())
  companyId   String   @map("company_id")
  name        String
  type        String   @default("email")
  subject     String?
  body        String
  variables   Json     @default("[]")
  isActive    Boolean  @default(true) @map("is_active")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  company Company @relation(fields: [companyId], references: [companyId])

  @@map("message_templates")
}

// ── Project ───────────────────────────────────────────────────
model Project {
  id          String   @id @default(cuid())
  companyId   String   @map("company_id")
  clientId    String?  @map("client_id")
  name        String
  description String?
  status      String   @default("ACTIVE")
  startDate   DateTime? @map("start_date")
  endDate     DateTime? @map("end_date")
  budget      Float?
  currency    String   @default("INR")
  metadata    Json?
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  company     Company             @relation(fields: [companyId], references: [companyId])
  client      Client?             @relation(fields: [clientId], references: [clientId])
  assignments ProjectAssignment[]
  credentials ProjectCredential[]
  documents   ProjectDocument[]
  history     ProjectHistory[]

  @@map("projects")
}

// ── ProjectAssignment ─────────────────────────────────────────
model ProjectAssignment {
  id        String   @id @default(cuid())
  projectId String   @map("project_id")
  userId    String   @map("user_id")
  role      String   @default("MEMBER")
  createdAt DateTime @default(now()) @map("created_at")

  project Project @relation(fields: [projectId], references: [id])
  user    User    @relation(fields: [userId], references: [userId])

  @@unique([projectId, userId])
  @@map("project_assignments")
}

// ── ProjectCredential ─────────────────────────────────────────
model ProjectCredential {
  id        String   @id @default(cuid())
  projectId String   @map("project_id")
  label     String
  username  String?
  password  String?
  url       String?
  notes     String?
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  project Project @relation(fields: [projectId], references: [id])

  @@map("project_credentials")
}

// ── ProjectDocument ───────────────────────────────────────────
model ProjectDocument {
  id        String   @id @default(cuid())
  projectId String   @map("project_id")
  name      String
  url       String?
  type      String?
  size      Int?
  createdAt DateTime @default(now()) @map("created_at")

  project Project @relation(fields: [projectId], references: [id])

  @@map("project_documents")
}

// ── ProjectHistory ────────────────────────────────────────────
model ProjectHistory {
  id          String   @id @default(cuid())
  projectId   String   @map("project_id")
  userId      String?  @map("user_id")
  action      String
  description String?
  metadata    Json?
  createdAt   DateTime @default(now()) @map("created_at")

  project Project @relation(fields: [projectId], references: [id])

  @@map("project_history")
}

// ── SeoAudit ──────────────────────────────────────────────────
model SeoAudit {
  id          String   @id @default(cuid())
  companyId   String   @map("company_id")
  domain      String
  score       Int?
  issues      Json?
  report      Json?
  createdAt   DateTime @default(now()) @map("created_at")

  company Company @relation(fields: [companyId], references: [companyId])

  @@map("seo_audits")
}

// ── SeoKeyword ────────────────────────────────────────────────
model SeoKeyword {
  id          String   @id @default(cuid())
  companyId   String   @map("company_id")
  keyword     String
  position    Int?
  volume      Int?
  difficulty  Int?
  url         String?
  updatedAt   DateTime @updatedAt @map("updated_at")
  createdAt   DateTime @default(now()) @map("created_at")

  company Company @relation(fields: [companyId], references: [companyId])

  @@map("seo_keywords")
}
MODELS

echo "✅ All missing models added to schema"