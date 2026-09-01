import { Injectable } from '@nestjs/common';
import {
  ServiceRequestBase,
  ServiceRequestDetail,
  ServiceRequestJobCard,
  ServiceRequestSummary,
  ServiceRequestTask,
  SqlRow,
} from '../models/service-request.model';

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

/** Maps raw SERREQUEST + detail rows to canonical, safe Service Request DTOs. */
@Injectable()
export class ServiceRequestMapper {
  toSummary(row: SqlRow): ServiceRequestSummary {
    return {
      serviceRequestNumber: str(row.SRENUM_0) ?? '',
      description: str(row.SREDES_0),
      status: num(row.XSTATUS_0),
      serviceDate: iso(row.XSRDATE_0),
      createdDate: iso(row.CREDAT_0),
      customer: str(row.SREBPC_0),
      address: this.address(row),
      routeNumber: str(row.XDRN_0),
    };
  }

  toDetail(
    header: SqlRow,
    bases: SqlRow[],
    tasks: SqlRow[],
    jobCards: SqlRow[],
  ): ServiceRequestDetail {
    return {
      ...this.toSummary(header),
      bases: bases.map((b) => this.toBase(b)),
      tasks: tasks.map((t) => this.toTask(t)),
      jobCards: jobCards.map((j) => this.toJobCard(j)),
    };
  }

  private toBase(row: SqlRow): ServiceRequestBase {
    return {
      lineNumber: num(row.XLINUM_0),
      componentItem: str(row.XCPNITM_0),
      description: str(row.XCPNTMDES_0),
      quantity: num(row.XCPNQTY_0),
      unit: str(row.XUOM_0),
      machineNumber: str(row.XMACNUM_0),
      machineSerial: str(row.XMACSERNUM_0),
    };
  }

  private toTask(row: SqlRow): ServiceRequestTask {
    return {
      taskNumber: str(row.HDTNUM_0),
      type: num(row.HDTTYP_0),
      item: str(row.HDTITM_0),
      quantity: num(row.HDTQTY_0),
      unit: str(row.HDTUOM_0),
      assignee: str(row.HDTAUS_0),
      plannedDate: iso(row.HDTPLNDAT_0),
      doneDate: iso(row.HDTDONDAT_0),
    };
  }

  private toJobCard(row: SqlRow): ServiceRequestJobCard {
    return {
      jobCardNumber: str(row.XJOBCARD_0),
      technicianId: str(row.XTECH_0),
      base: str(row.XBASE_0),
      routeNumber: str(row.XDRN_0),
      startDate: iso(row.XSTRDATE_0),
      startTime: str(row.XSTRTIME_0),
      endDate: iso(row.XENDDATE_0),
      endTime: str(row.XENDTIME_0),
      type: num(row.XTYPE_0),
      duration: str(row.XDURATION_0),
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
