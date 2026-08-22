import {
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Public } from '../../common/auth/public.decorator';
import { ApiErrorResponse } from '../../common/errors/api-error.response';
import { WorksuiteWebhookResponse } from './dto/webhook.dto';
import {
  WORKSUITE_WEBHOOK_HEADERS,
  WorksuiteWebhookService,
} from './worksuite-webhook.service';

/**
 * Inbound WorkSuite contractor webhook endpoint.
 *
 * PUBLIC (bypasses the bearer AuthGuard) because WorkSuite authenticates via
 * the HMAC signature, not a TEMA bearer token. All verification, idempotency
 * and syncing is delegated to the service. HMAC is computed over the RAW body,
 * which is captured via Nest's `rawBody: true` option (see main.ts).
 */
@ApiTags('WorkSuite Webhooks')
@Controller('api/webhooks/worksuite')
export class WorksuiteWebhookController {
  constructor(private readonly service: WorksuiteWebhookService) {}

  @Post()
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive a WorkSuite contractor lifecycle webhook' })
  @ApiHeader({ name: WORKSUITE_WEBHOOK_HEADERS.timestamp, required: true })
  @ApiHeader({ name: WORKSUITE_WEBHOOK_HEADERS.signature, required: true })
  @ApiHeader({ name: WORKSUITE_WEBHOOK_HEADERS.eventId, required: true })
  @ApiOkResponse({ type: WorksuiteWebhookResponse })
  @ApiUnauthorizedResponse({
    type: ApiErrorResponse,
    description: 'Signature/timestamp/event-id verification failed',
  })
  @ApiServiceUnavailableResponse({
    type: ApiErrorResponse,
    description: 'Webhook disabled or not configured',
  })
  async receive(
    @Req() req: RawBodyRequest<Request>,
    @Headers(WORKSUITE_WEBHOOK_HEADERS.timestamp) timestamp?: string,
    @Headers(WORKSUITE_WEBHOOK_HEADERS.signature) signature?: string,
    @Headers(WORKSUITE_WEBHOOK_HEADERS.eventId) eventId?: string,
  ): Promise<WorksuiteWebhookResponse> {
    return this.service.handle(req.rawBody, { timestamp, signature, eventId });
  }
}
