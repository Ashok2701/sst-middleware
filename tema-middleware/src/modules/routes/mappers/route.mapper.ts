import { Injectable } from '@nestjs/common';
import { Route, RouteDetail, RouteHeader, SqlRow } from '../models/route.model';

function str(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  return s.length ? s : undefined;
}
function num(v: unknown): number | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
function iso(v: unknown): string | undefined {
  if (!v) return undefined;
  const d = new Date(v as string);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

@Injectable()
export class RouteMapper {
  toHeader(row: SqlRow): RouteHeader {
    return {
      xdrn: str(row.XDRN_0) ?? '',
      status: num(row.XROUTSTATUS_0),
      routeDate: iso(row.XROUTDATE_0),
      technicianId: str(row.XTECHID_0),
      technicianName: str(row.XTECHNAM_0),
      site: str(row.XSITE_0),
      trip: num(row.XTRIP_0),
      createdBy: str(row.XBYUSER_0),
    };
  }

  toDetail(row: SqlRow): RouteDetail {
    return {
      lineNumber: num(row.XDRNLIN_0),
      documentNumber: str(row.XDOCNUM_0),
      customerOrder: str(row.XBPCORD_0),
      customerName: str(row.XBPNAME_0),
      status: num(row.XSTATUS_0),
      serviceRequestNumber: str(row.XSERNUM_0),
      eta: str(row.XETA_0),
      etd: str(row.XETD_0),
      shipDate: iso(row.XSHIDAT_0),
      deliveryDate: iso(row.XDLVDAT_0),
      address: this.address(row),
    };
  }

  toRoute(header: SqlRow, details: SqlRow[]): Route {
    return {
      ...this.toHeader(header),
      details: details.map((d) => this.toDetail(d)),
    };
  }

  private address(row: SqlRow): string | undefined {
    const parts = [
      str(row.XBPAADDLIG_0),
      str(row.XCTY_0),
      str(row.XPOSCOD_0),
      str(row.XCRY_0),
    ].filter((p): p is string => !!p);
    return parts.length ? parts.join(', ') : undefined;
  }
}
