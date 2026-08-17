import { Injectable } from '@nestjs/common';
import { join } from 'path';
import { DEFAULT_VERSION, SERVICE_NAME } from '../common/constants';
import { VersionResponse } from './version.dto';

/** Exposes service name and version (read from package.json at runtime). */
@Injectable()
export class VersionService {
  getVersion(): VersionResponse {
    return { service: SERVICE_NAME, version: this.resolveVersion() };
  }

  private resolveVersion(): string {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pkg = require(join(process.cwd(), 'package.json'));
      return pkg.version ?? DEFAULT_VERSION;
    } catch {
      return DEFAULT_VERSION;
    }
  }
}
