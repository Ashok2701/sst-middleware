import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { LoggerModule } from 'nestjs-pino';
import { IncomingMessage, ServerResponse } from 'http';
import { SERVICE_NAME } from '../constants';
import { CORRELATION_ID_HEADER } from '../correlation/correlation.constants';

/**
 * Structured (JSON) logging built on pino / nestjs-pino.
 *
 * Every HTTP request/response is logged automatically with:
 *   timestamp, level, service, correlationId (request id),
 *   HTTP method, path, response status and request duration.
 *
 * Sensitive fields (auth headers, cookies, passwords, tokens, secrets)
 * are redacted and never written to the logs.
 */
@Module({
  imports: [
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isProd = config.get<string>('nodeEnv') === 'production';
        return {
          pinoHttp: {
            level: config.get<string>('logLevel') ?? 'info',
            base: { service: SERVICE_NAME },
            genReqId: (req: IncomingMessage, res: ServerResponse) => {
              const header = req.headers[CORRELATION_ID_HEADER];
              const fromHeader = Array.isArray(header) ? header[0] : header;
              const id =
                (req as any).correlationId || fromHeader || randomUUID();
              (req as any).correlationId = id;
              if (!res.getHeader(CORRELATION_ID_HEADER)) {
                res.setHeader(CORRELATION_ID_HEADER, id);
              }
              return id;
            },
            customProps: (req: IncomingMessage) => ({
              service: SERVICE_NAME,
              correlationId: (req as any).id,
            }),
            autoLogging: true,
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'req.headers["x-api-key"]',
                'req.headers["set-cookie"]',
                'res.headers["set-cookie"]',
                'req.body.password',
                'req.body.token',
                'req.body.accessToken',
                'req.body.refreshToken',
                'req.body.clientSecret',
                'req.body.apiKey',
              ],
              remove: true,
            },
            transport: isProd
              ? undefined
              : {
                  target: 'pino-pretty',
                  options: { singleLine: true, translateTime: 'SYS:standard' },
                },
          },
        };
      },
    }),
  ],
})
export class LoggingModule {}
