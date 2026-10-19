import 'dotenv/config';
import assert = require('node:assert/strict');
import { randomUUID } from 'node:crypto';
import { spawn, spawnSync, ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { createWriteStream, mkdtempSync, WriteStream } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PrismaClient } from '@prisma/client';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function freePort() {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as { port: number }).port;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}
async function stopProcess(child?: ChildProcess) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise<void>((resolve) =>
    child.once('exit', () => resolve()),
  );
  child.kill('SIGTERM');
  let forced = false;
  const timer = setTimeout(() => {
    forced = true;
    child.kill('SIGKILL');
  }, 6000);
  await exited;
  clearTimeout(timer);
  assert.equal(forced, false, 'Fixture child did not shut down gracefully');
}

/** Business writes/migrations only touch this fixture UUID DB/Redis/app. */
export class LocalBackendFixture {
  readonly secret = randomUUID();
  readonly databaseName = 'aihn_e2e_' + randomUUID().replaceAll('-', '');
  readonly directory = mkdtempSync(join(tmpdir(), 'aihn-e2e-'));
  readonly containerName = 'aihn-e2e-' + randomUUID();
  prisma: PrismaClient;
  origin: string;
  private master: PrismaClient;
  private databaseCreated = false;
  private redis: ChildProcess;
  private app: ChildProcess;
  private log: WriteStream;
  private stopped = false;
  constructor(private readonly image?: string) {}

  async start() {
    try {
      const source = new URL(process.env.DATABASE_URL!);
      assert.ok(
        ['localhost', '127.0.0.1', '[::1]'].includes(source.hostname),
        'Fixture requires local PostgreSQL',
      );
      source.searchParams.set('connect_timeout', '5');
      const fixture = new URL(source);
      fixture.pathname = '/' + this.databaseName;
      this.master = new PrismaClient({
        datasources: { db: { url: source.toString() } },
      });
      await this.master.$executeRawUnsafe(
        `CREATE DATABASE "${this.databaseName}"`,
      );
      this.databaseCreated = true;
      await this.master.$executeRawUnsafe(
        `ALTER DATABASE "${this.databaseName}" SET statement_timeout TO '15s'`,
      );
      this.prisma = new PrismaClient({
        datasources: { db: { url: fixture.toString() } },
      });
      const migrationEnv = { ...process.env, DATABASE_URL: fixture.toString() };
      const migration = this.image
        ? spawnSync(
            'docker',
            [
              'run',
              '--rm',
              '--network',
              'host',
              '--env',
              'DATABASE_URL',
              this.image,
              'pnpm',
              'exec',
              'prisma',
              'migrate',
              'deploy',
            ],
            { env: migrationEnv, timeout: 60000, encoding: 'utf8' },
          )
        : spawnSync(
            process.execPath,
            ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
            { env: migrationEnv, timeout: 60000, encoding: 'utf8' },
          );
      assert.equal(migration.status, 0, 'Fixture migration failed');
      const redisPort = await freePort(),
        password = randomUUID();
      this.redis = spawn(
        'redis-server',
        [
          '--bind',
          '127.0.0.1',
          '--port',
          String(redisPort),
          '--requirepass',
          password,
          '--save',
          '',
          '--appendonly',
          'no',
          '--dir',
          this.directory,
        ],
        { stdio: 'ignore' },
      );
      this.redis.on('error', () => {});
      const port = await freePort();
      this.origin = `http://127.0.0.1:${port}`;
      const env = {
        ...migrationEnv,
        NODE_ENV: 'production',
        API_VERSION: 'v1',
        PORT: String(port),
        JWT_ACCESS_SECRET: this.secret,
        JWT_REFRESH_SECRET: randomUUID(),
        REDIS_HOST: '127.0.0.1',
        REDIS_PORT: String(redisPort),
        REDIS_PASSWORD: password,
        AI_WS_URL: 'ws://127.0.0.1:1',
        CORS_ORIGINS: this.origin,
      };
      this.log = createWriteStream(join(this.directory, 'application.log'));
      const dockerEnv = [
        'DATABASE_URL',
        'NODE_ENV',
        'API_VERSION',
        'PORT',
        'JWT_ACCESS_SECRET',
        'JWT_REFRESH_SECRET',
        'REDIS_HOST',
        'REDIS_PORT',
        'REDIS_PASSWORD',
        'AI_WS_URL',
        'CORS_ORIGINS',
      ].flatMap((name) => ['--env', name]);
      this.app = this.image
        ? spawn(
            'docker',
            [
              'run',
              '--name',
              this.containerName,
              '--network',
              'host',
              ...dockerEnv,
              this.image,
            ],
            { env, stdio: ['ignore', 'pipe', 'pipe'] },
          )
        : spawn(process.execPath, ['dist/src/main'], {
            env,
            stdio: ['ignore', 'pipe', 'pipe'],
          });
      this.app.on('error', () => {});
      this.app.stdout.pipe(this.log);
      this.app.stderr.pipe(this.log);
      const deadline = Date.now() + 30000;
      while (Date.now() < deadline) {
        assert.equal(
          this.app.exitCode,
          null,
          'Fixture app exited before readiness',
        );
        try {
          if (
            (
              await fetch(this.origin + '/api/v1/health/ready', {
                signal: AbortSignal.timeout(1000),
              })
            ).status === 200
          )
            return;
        } catch {
          /* dependency startup */
        }
        await delay(100);
      }
      throw new Error('Fixture readiness timeout');
    } catch (error) {
      await this.stop();
      throw error;
    }
  }

  async stop() {
    if (this.stopped) return;
    this.stopped = true;
    const errors: unknown[] = [];
    const cleanup = async (action: () => Promise<unknown> | unknown) => {
      try {
        await action();
      } catch (error) {
        errors.push(error);
      }
    };
    if (this.image && this.app) {
      await cleanup(() => {
        const result = spawnSync(
          'docker',
          ['stop', '--time', '6', this.containerName],
          { timeout: 10000, stdio: 'ignore' },
        );
        assert.equal(result.status, 0, 'Owned container shutdown failed');
        const inspected = spawnSync(
          'docker',
          ['inspect', '--format', '{{json .State}}', this.containerName],
          { encoding: 'utf8', timeout: 3000 },
        );
        assert.equal(inspected.status, 0);
        const state = JSON.parse(inspected.stdout);
        assert.equal(state.Running, false);
        assert.notEqual(
          state.ExitCode,
          137,
          'App was killed instead of graceful shutdown',
        );
      });
      // Remove only the UUID container owned by this fixture. Never prune.
      spawnSync('docker', ['rm', '--force', this.containerName], {
        timeout: 5000,
        stdio: 'ignore',
      });
    }
    await cleanup(() => stopProcess(this.app));
    await cleanup(() => stopProcess(this.redis));
    await cleanup(() => this.prisma?.$disconnect());
    if (this.databaseCreated)
      await cleanup(async () => {
        await this.master.$executeRawUnsafe(
          `DROP DATABASE "${this.databaseName}" WITH (FORCE)`,
        );
        this.databaseCreated = false;
      });
    await cleanup(() => this.master?.$disconnect());
    this.log?.end();
    if (errors.length)
      throw new Error(
        `Fixture cleanup failed (${errors.length} operations); see ${this.directory}`,
      );
  }
}
