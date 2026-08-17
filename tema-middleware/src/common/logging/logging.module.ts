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
 *   timestamp (time), level, service, correlationId,
 *   HTTP method, request path, response statusCode, durationMs and error info.
 *
 * Sensitive fields (auth headers, cookies, passwords, tokens, secrets, db
 * passwords) are redacted and never written to the logs.
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
            // Expose the request id as `correlationId` on every log line.
            customProps: (req: IncomingMessage) => ({
              correlationId: (req as any).id,
            }),
            // Rename pino's `responseTime` to the friendlier `durationMs`.
            customAttributeKeys: { responseTime: 'durationMs' },
            autoLogging: true,
            // Basic sensitive-data masking: these paths are removed from logs.
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'req.headers["x-api-key"]',
                'req.headers["proxy-authorization"]',
                'req.headers["set-cookie"]',
                'res.headers["set-cookie"]',
                'req.body.password',
                'req.body.passwordConfirmation',
                'req.body.token',
                'req.body.accessToken',
                'req.body.refreshToken',
                'req.body.clientSecret',
                'req.body.apiKey',
                'req.body.secret',
                'req.body.databasePassword',
                'req.body.dbPassword',
                'req.body.ssn',
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
