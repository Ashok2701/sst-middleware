/**
 * Phase 3.6 - Route read models + XDRN generation (READ-only; no INSERTs yet).
 * Header: XX1ROUTPOH (XDRN_0). Detail: XX1ROUTPOD (XDRN_0 + XDRNLIN_0).
 */

export interface RouteDetail {
  lineNumber?: number;
  documentNumber?: string;
  customerOrder?: string;
  customerName?: string;
  status?: number;
  serviceRequestNumber?: string;
  eta?: string;
  etd?: string;
  shipDate?: string;
  deliveryDate?: string;
  address?: string;
}

export interface RouteHeader {
  xdrn: string;
  status?: number;
  routeDate?: string;
  technicianId?: string;
  technicianName?: string;
  site?: string;
  trip?: number;
  createdBy?: string;
}

export interface Route extends RouteHeader {
  details: RouteDetail[];
}

export type SqlRow = Record<string, unknown>;
