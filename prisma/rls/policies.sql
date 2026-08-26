-- Phase 13 D5 (ADR-0002): PostgreSQL Row-Level Security policies.
-- These policies enforce site isolation at the database level (defense-in-depth).
-- The application-layer site-scope filter (Phase 1) remains the primary enforcement;
-- RLS is the DB-level backstop against any path that bypasses the repository.
--
-- PREREQUISITE: PostgreSQL with the Circum schema migrated (prisma migrate deploy).
-- USAGE: psql -d circum -f prisma/rls/policies.sql
--
-- The app sets the site scope per request via:
--   SET LOCAL app.site_scope = '<siteId1>,<siteId2>';
-- (set by a request middleware from AuthContext.resolvedSites)
-- super_admin (site_scope = '*') bypasses RLS.

-- Enable RLS on all site-owned tables
-- (siteId is the isolation column; global tables have no siteId and don't need RLS)
ALTER TABLE MaterialLot ENABLE ROW LEVEL SECURITY;
ALTER TABLE WorkOrder ENABLE ROW LEVEL SECURITY;
ALTER TABLE ManufacturingBatch ENABLE ROW LEVEL SECURITY;
ALTER TABLE DeviceLot ENABLE ROW LEVEL SECURITY;
ALTER TABLE OperationExecution ENABLE ROW LEVEL SECURITY;
ALTER TABLE NCR ENABLE ROW LEVEL SECURITY;
ALTER TABLE Deviation ENABLE ROW LEVEL SECURITY;
ALTER TABLE Investigation ENABLE ROW LEVEL SECURITY;
ALTER TABLE CAPA ENABLE ROW LEVEL SECURITY;
ALTER TABLE ChangeControl ENABLE ROW LEVEL SECURITY;
ALTER TABLE RiskAssessment ENABLE ROW LEVEL SECURITY;
ALTER TABLE Equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE MaintenanceRecord ENABLE ROW LEVEL SECURITY;
ALTER TABLE CalibrationRecord ENABLE ROW LEVEL SECURITY;
ALTER TABLE DowntimeEvent ENABLE ROW LEVEL SECURITY;
ALTER TABLE AiConversation ENABLE ROW LEVEL SECURITY;
ALTER TABLE IntegrationConfig ENABLE ROW LEVEL SECURITY;

-- Policy: users can only see rows at their authorized sites
-- (app.site_scope is a comma-separated list of siteIds, or '*' for super_admin)
CREATE POLICY site_isolation ON MaterialLot
  USING (site_scope_setting_has_site(siteId));
CREATE POLICY site_isolation ON WorkOrder
  USING (site_scope_setting_has_site(siteId));
CREATE POLICY site_isolation ON ManufacturingBatch
  USING (site_scope_setting_has_site(siteId));
CREATE POLICY site_isolation ON DeviceLot
  USING (site_scope_setting_has_site(siteId));
CREATE POLICY site_isolation ON NCR
  USING (site_scope_setting_has_site(siteId));
CREATE POLICY site_isolation ON Deviation
  USING (site_scope_setting_has_site(siteId));
CREATE POLICY site_isolation ON Investigation
  USING (site_scope_setting_has_site(siteId));
CREATE POLICY site_isolation ON CAPA
  USING (site_scope_setting_has_site(siteId));
CREATE POLICY site_isolation ON ChangeControl
  USING (site_scope_setting_has_site(siteId));
CREATE POLICY site_isolation ON RiskAssessment
  USING (site_scope_setting_has_site(siteId));
CREATE POLICY site_isolation ON Equipment
  USING (site_scope_setting_has_site(siteId));
CREATE POLICY site_isolation ON MaintenanceRecord
  USING (site_scope_setting_has_site(siteId));
CREATE POLICY site_isolation ON CalibrationRecord
  USING (site_scope_setting_has_site(siteId));
ALTER TABLE MaintenanceRecord FORCE ROW LEVEL SECURITY;
ALTER TABLE CalibrationRecord FORCE ROW LEVEL SECURITY;
CREATE POLICY site_isolation ON DowntimeEvent
  USING (site_scope_setting_has_site(siteId));
CREATE POLICY site_isolation ON AiConversation
  USING (site_scope_setting_has_site(siteId));
CREATE POLICY site_isolation ON IntegrationConfig
  USING (siteId IS NULL OR site_scope_setting_has_site(siteId));

-- Helper function: checks if the current site_scope setting includes the given siteId
CREATE OR REPLACE FUNCTION site_scope_setting_has_site(target_site_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  scope_text TEXT;
BEGIN
  scope_text := current_setting('app.site_scope', true);
  IF scope_text IS NULL OR scope_text = '' THEN
    RETURN false;
  END IF;
  IF scope_text = '*' THEN
    RETURN true;
  END IF;
  RETURN position(target_site_id IN scope_text) > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- NOTE: The application must set app.site_scope per request:
--   await db.$executeRaw`SET LOCAL app.site_scope = ${siteScopeString}`;
-- This is done in a request middleware that reads AuthContext.resolvedSites.
-- The repository-layer site-scope filter (Phase 1) remains as defense-in-depth.
