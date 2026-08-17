import { Test } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;
  let service: HealthService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [HealthService],
    }).compile();

    controller = moduleRef.get(HealthController);
    service = moduleRef.get(HealthService);
  });

  it('reports liveness as UP', () => {
    expect(controller.liveness()).toEqual({
      status: 'UP',
      service: 'tema-middleware',
    });
  });

  it('reports readiness as READY when ready', () => {
    expect(controller.readiness()).toEqual({
      status: 'READY',
      service: 'tema-middleware',
      checks: [],
    });
  });

  it('throws ServiceUnavailable when not ready', () => {
    service.setReady(false);
    expect(() => controller.readiness()).toThrow(ServiceUnavailableException);
  });
});
