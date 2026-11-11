BEGIN;
CREATE TYPE public."KnowledgeStatus" AS ENUM ('draft', 'published', 'retired');
CREATE TABLE public."KnowledgeRule" (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL CHECK (length(trim(topic)) BETWEEN 3 AND 120),
  answer TEXT NOT NULL CHECK (length(trim(answer)) BETWEEN 10 AND 2500),
  terms TEXT[] NOT NULL CHECK (cardinality(terms) BETWEEN 1 AND 24),
  "sourceTitle" TEXT NOT NULL CHECK (length(trim("sourceTitle")) BETWEEN 3 AND 180),
  "sourceUrl" TEXT NOT NULL CHECK ("sourceUrl" ~ '^https://[^[:space:]]+$'),
  "reviewedAt" DATE NOT NULL,
  "expiresAt" DATE,
  "relatedListingIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[] CHECK (cardinality("relatedListingIds") <= 12),
  status public."KnowledgeStatus" NOT NULL DEFAULT 'draft',
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  "updatedBy" UUID NOT NULL REFERENCES public."Account"(id) ON DELETE RESTRICT,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ("expiresAt" IS NULL OR "expiresAt" >= "reviewedAt")
);
CREATE INDEX "KnowledgeRule_status_expiresAt_idx" ON public."KnowledgeRule"(status, "expiresAt");
CREATE INDEX "KnowledgeRule_updatedAt_idx" ON public."KnowledgeRule"("updatedAt");

CREATE TABLE public."KnowledgeRuleAudit" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "ruleId" TEXT NOT NULL REFERENCES public."KnowledgeRule"(id) ON DELETE RESTRICT,
  "actorId" UUID NOT NULL REFERENCES public."Account"(id) ON DELETE RESTRICT,
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'published', 'retired')),
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 3 AND 500),
  version INTEGER NOT NULL CHECK (version > 0),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "KnowledgeRuleAudit_ruleId_createdAt_idx" ON public."KnowledgeRuleAudit"("ruleId", "createdAt");

ALTER TABLE public."KnowledgeRule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."KnowledgeRuleAudit" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."KnowledgeRule", public."KnowledgeRuleAudit" FROM PUBLIC, anon, authenticated, gochitral_public;
GRANT SELECT ON public."KnowledgeRule" TO gochitral_public;
GRANT SELECT, INSERT, UPDATE ON public."KnowledgeRule" TO authenticated;
GRANT SELECT, INSERT ON public."KnowledgeRuleAudit" TO authenticated;

CREATE POLICY knowledge_active_public ON public."KnowledgeRule" FOR SELECT TO gochitral_public
  USING (status = 'published' AND ("expiresAt" IS NULL OR "expiresAt" >= CURRENT_DATE));
CREATE POLICY knowledge_admin_read ON public."KnowledgeRule" FOR SELECT TO authenticated
  USING (public.gochitral_is_admin());
CREATE POLICY knowledge_admin_insert ON public."KnowledgeRule" FOR INSERT TO authenticated
  WITH CHECK (public.gochitral_is_admin() AND "updatedBy" = public.gochitral_user_id());
CREATE POLICY knowledge_admin_update ON public."KnowledgeRule" FOR UPDATE TO authenticated
  USING (public.gochitral_is_admin())
  WITH CHECK (public.gochitral_is_admin() AND "updatedBy" = public.gochitral_user_id());
CREATE POLICY knowledge_audit_admin_read ON public."KnowledgeRuleAudit" FOR SELECT TO authenticated
  USING (public.gochitral_is_admin());
CREATE POLICY knowledge_audit_admin_insert ON public."KnowledgeRuleAudit" FOR INSERT TO authenticated
  WITH CHECK (public.gochitral_is_admin() AND "actorId" = public.gochitral_user_id());
COMMIT;
