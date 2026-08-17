import { INestApplication, Body, Controller, Get, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup';

/** Sample DTO exercising the global validation foundation. */
class SampleDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsInt()
  @Min(1)
  count: number;
}

/** Test-only controller to exercise validation and error handling paths. */
@Controller('__test')
class ValidationTestController {
  @Post('validate')
  validate(@Body() dto: SampleDto): SampleDto {
    return dto;
  }

  @Get('boom')
  boom(): never {
    throw new Error('internal explosion with secret=supersecret');
  }
}

describe('Validation & error handling (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ValidationTestController],
    }).compile();

    app = moduleRef.createNestApplication({ bufferLogs: true });
    setupApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('accepts a valid payload', async () => {
    const res = await request(app.getHttpServer())
      .post('/__test/validate')
      .send({ name: 'tema', count: 3 })
      .expect(201);
    expect(res.body).toEqual({ name: 'tema', count: 3 });
  });

  it('rejects an invalid payload with a consistent VALIDATION_ERROR', async () => {
    const res = await request(app.getHttpServer())
      .post('/__test/validate')
      .send({ name: '', count: 0 })
      .expect(400);

    expect(res.body).toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      requestId: expect.any(String),
    });
    expect(Array.isArray(res.body.details)).toBe(true);
    expect(res.body.details.length).toBeGreaterThan(0);
  });

  it('strips unknown properties (whitelist)', async () => {
    const res = await request(app.getHttpServer())
      .post('/__test/validate')
      .send({ name: 'tema', count: 2, injected: 'nope' })
      .expect(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('never leaks internal details on a 500 error', async () => {
    const res = await request(app.getHttpServer())
      .get('/__test/boom')
      .expect(500);

    expect(res.body).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      requestId: expect.any(String),
    });
    expect(JSON.stringify(res.body)).not.toContain('supersecret');
  });
});
