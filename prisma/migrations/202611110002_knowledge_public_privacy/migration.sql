BEGIN;
DROP POLICY knowledge_admin_insert ON public."KnowledgeRule";
DROP POLICY knowledge_admin_update ON public."KnowledgeRule";
ALTER TABLE public."KnowledgeRule" ALTER COLUMN "updatedBy" DROP NOT NULL;
CREATE POLICY knowledge_admin_insert ON public."KnowledgeRule" FOR INSERT TO authenticated
  WITH CHECK (public.gochitral_is_admin());
CREATE POLICY knowledge_admin_update ON public."KnowledgeRule" FOR UPDATE TO authenticated
  USING (public.gochitral_is_admin()) WITH CHECK (public.gochitral_is_admin());
COMMIT;
