import { index } from "drizzle-orm/pg-core";
import { sitesTable } from "./sites";
import { nodesTable } from "./nodes";
import { siteFilesTable } from "./deployments";
import { federationEventsTable } from "./federation";

// Sites indexes
export const sitesDomainIdx = index("sites_domain_idx").on(sitesTable.domain);
export const sitesOwnerIdx = index("sites_owner_idx").on(sitesTable.ownerId);
export const sitesStatusIdx = index("sites_status_idx").on(sitesTable.status);
export const sitesPrimaryNodeIdx = index("sites_primary_node_idx").on(sitesTable.primaryNodeId);

// Nodes indexes
export const nodesStatusIdx = index("nodes_status_idx").on(nodesTable.status);
export const nodesDomainIdx = index("nodes_domain_idx").on(nodesTable.domain);
export const nodesLocalIdx = index("nodes_local_idx").on(nodesTable.isLocalNode);

// Site files indexes
export const siteFilesSiteIdx = index("site_files_site_idx").on(siteFilesTable.siteId);
export const siteFilesPathIdx = index("site_files_path_idx").on(siteFilesTable.siteId, siteFilesTable.filePath);
export const siteFilesDeploymentIdx = index("site_files_deployment_idx").on(siteFilesTable.deploymentId);

// Federation events indexes
export const federationEventsTypeIdx = index("federation_events_type_idx").on(federationEventsTable.eventType);
export const federationEventsFromIdx = index("federation_events_from_idx").on(federationEventsTable.fromNodeDomain);
export const federationEventsCreatedIdx = index("federation_events_created_idx").on(federationEventsTable.createdAt);
