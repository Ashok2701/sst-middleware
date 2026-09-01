/**
 * Phase 3.6 - Service Request read models (READ-ONLY; no CRUD).
 *
 * Composed via middleware JOIN/child queries (no DB DDL). Header source:
 * SERREQUEST (SRENUM_0). Nested detail: XFSMBASE (XSERNUM_0), HDKTASK
 * (SRENUM_0), X1CJOBCARD (XSRENUM_0). Only a minimal safe field subset is
 * exposed - no invented fields.
 */

export interface ServiceRequestSummary {
  serviceRequestNumber: string;
  description?: string;
  status?: number;
  serviceDate?: string;
  createdDate?: string;
  customer?: string;
  address?: string;
  routeNumber?: string;
}

export interface ServiceRequestBase {
  lineNumber?: number;
  componentItem?: string;
  description?: string;
  quantity?: number;
  unit?: string;
  machineNumber?: string;
  machineSerial?: string;
}

export interface ServiceRequestTask {
  taskNumber?: string;
  type?: number;
  item?: string;
  quantity?: number;
  unit?: string;
  assignee?: string;
  plannedDate?: string;
  doneDate?: string;
}

export interface ServiceRequestJobCard {
  jobCardNumber?: string;
  technicianId?: string;
  base?: string;
  routeNumber?: string;
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  type?: number;
  duration?: string;
}

export interface ServiceRequestDetail extends ServiceRequestSummary {
  bases: ServiceRequestBase[];
  tasks: ServiceRequestTask[];
  jobCards: ServiceRequestJobCard[];
}

export type SqlRow = Record<string, unknown>;
