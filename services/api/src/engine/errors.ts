export type EngineFailureKind = 'unavailable' | 'timeout' | 'invalid_response' | 'no_route_found';

const publicErrors: Record<EngineFailureKind, { statusCode: number; code: string; message: string }> = {
  unavailable: {
    statusCode: 503,
    code: 'ENGINE_UNAVAILABLE',
    message: 'O motor de rotas está indisponível.',
  },
  timeout: {
    statusCode: 504,
    code: 'ENGINE_TIMEOUT',
    message: 'O motor de rotas excedeu o tempo limite.',
  },
  invalid_response: {
    statusCode: 502,
    code: 'ENGINE_INVALID_RESPONSE',
    message: 'O motor de rotas retornou uma resposta inválida.',
  },
  no_route_found: {
    statusCode: 422,
    code: 'NO_ROUTE_FOUND',
    message: 'Não existe caminho válido entre os pontos solicitados.',
  },
};

export class EngineClientError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly publicMessage: string;

  constructor(readonly kind: EngineFailureKind, options?: ErrorOptions) {
    const publicError = publicErrors[kind];
    super(publicError.message, options);
    this.name = 'EngineClientError';
    this.statusCode = publicError.statusCode;
    this.code = publicError.code;
    this.publicMessage = publicError.message;
  }
}

export interface PublicApiError {
  statusCode: number;
  body: { error: { code: string; message: string } };
}

export function toPublicApiError(error: unknown): PublicApiError {
  if (error instanceof EngineClientError) {
    return {
      statusCode: error.statusCode,
      body: { error: { code: error.code, message: error.publicMessage } },
    };
  }

  if (error instanceof Error && error.name === 'RouteCalculationError' &&
    typeof (error as Error & { statusCode?: unknown }).statusCode === 'number' &&
    typeof (error as Error & { code?: unknown }).code === 'string') {
    const routeError = error as Error & { statusCode: number; code: string };
    return {
      statusCode: routeError.statusCode,
      body: { error: { code: routeError.code, message: error.message } },
    };
  }

  if (error instanceof Error && error.name === 'ProductRequestError' &&
    typeof (error as Error & { statusCode?: unknown }).statusCode === 'number' &&
    typeof (error as Error & { code?: unknown }).code === 'string') {
    const productError = error as Error & { statusCode: number; code: string };
    return {
      statusCode: productError.statusCode,
      body: { error: { code: productError.code, message: error.message } },
    };
  }

  if (error instanceof Error && error.name === 'OrderRequestError' &&
    typeof (error as Error & { statusCode?: unknown }).statusCode === 'number' &&
    typeof (error as Error & { code?: unknown }).code === 'string') {
    const orderError = error as Error & { statusCode: number; code: string };
    return {
      statusCode: orderError.statusCode,
      body: { error: { code: orderError.code, message: error.message } },
    };
  }

  if (error instanceof Error && error.name === 'InvalidRouteCalculationRequest') {
    return {
      statusCode: 400,
      body: { error: { code: 'INVALID_ROUTE_REQUEST', message: 'A requisição de cálculo é inválida.' } },
    };
  }

  if (typeof error === 'object' && error !== null && 'statusCode' in error) {
    const statusCode = error.statusCode;
    if (typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500) {
      const notFound = statusCode === 404;
      return {
        statusCode,
        body: {
          error: {
            code: notFound ? 'NOT_FOUND' : 'INVALID_REQUEST',
            message: notFound ? 'O recurso solicitado não foi encontrado.' : 'A requisição é inválida.',
          },
        },
      };
    }
  }

  return {
    statusCode: 500,
    body: { error: { code: 'INTERNAL_SERVER_ERROR', message: 'Ocorreu um erro interno.' } },
  };
}
