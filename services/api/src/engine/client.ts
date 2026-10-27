import {
  isEngineRouteResponse,
  matchesEngineRouteRequest,
  type EngineRouteRequest,
  type EngineRouteResponse,
} from './contracts.js';
import { EngineClientError } from './errors.js';

const DEFAULT_ENGINE_URL = 'http://engine:8000';
const DEFAULT_ENGINE_TIMEOUT_MS = 5_000;
const ENGINE_ROUTE_PATH = 'internal/v1/routes/calculate';

function parseEngineUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('ENGINE_URL must be a valid HTTP or HTTPS URL.');
  }

  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('ENGINE_URL must be an HTTP or HTTPS base URL without credentials, query, or fragment.');
  }

  return url;
}

function parseTimeout(value: string | undefined): number {
  if (value === undefined || value === '') return DEFAULT_ENGINE_TIMEOUT_MS;
  if (!/^\d+$/.test(value)) throw new Error('ENGINE_TIMEOUT_MS must be a positive integer.');

  const timeoutMs = Number(value);
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error('ENGINE_TIMEOUT_MS must be a positive integer.');
  }

  return timeoutMs;
}

export class EngineClient {
  private readonly baseUrl: URL;

  constructor(
    baseUrl: string,
    private readonly timeoutMs: number,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.baseUrl = parseEngineUrl(baseUrl);
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
      throw new Error('ENGINE_TIMEOUT_MS must be a positive integer.');
    }
  }

  async calculateRoute(request: EngineRouteRequest): Promise<EngineRouteResponse> {
    const url = new URL(ENGINE_ROUTE_PATH, this.baseUrl.href.endsWith('/') ? this.baseUrl : `${this.baseUrl.href}/`);
    const signal = AbortSignal.timeout(this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(request),
        signal,
      });
    } catch (error) {
      if (signal.aborted) throw new EngineClientError('timeout', { cause: error });
      throw new EngineClientError('unavailable', { cause: error });
    }

    if (!response.ok) {
      throw new EngineClientError(response.status >= 500 ? 'unavailable' : 'invalid_response');
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      if (signal.aborted) throw new EngineClientError('timeout', { cause: error });
      throw new EngineClientError('invalid_response', { cause: error });
    }

    if (!isEngineRouteResponse(payload) || !matchesEngineRouteRequest(payload, request)) {
      throw new EngineClientError('invalid_response');
    }
    return payload;
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    engineClient: EngineClient;
  }
}

export function createEngineClient(
  environment: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): EngineClient {
  return new EngineClient(
    environment.ENGINE_URL ?? DEFAULT_ENGINE_URL,
    parseTimeout(environment.ENGINE_TIMEOUT_MS),
    fetchImpl,
  );
}
