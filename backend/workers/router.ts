/**
 * StudyLoG.AI Backend - Simple Router
 * Lightweight routing without external dependencies
 */

import type { Env, RouteHandler } from './types';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS';

interface Route {
  method: HttpMethod;
  pattern: URLPattern;
  handler: RouteHandler;
}

export class Router {
  private routes: Route[] = [];
  private subrouters: Map<string, Router> = new Map();

  private addRoute(method: HttpMethod, path: string, handler: RouteHandler): void {
    const pattern = new URLPattern({ pathname: path });
    this.routes.push({ method, pattern, handler });
  }

  get(path: string, handler: RouteHandler): void {
    this.addRoute('GET', path, handler);
  }

  post(path: string, handler: RouteHandler): void {
    this.addRoute('POST', path, handler);
  }

  put(path: string, handler: RouteHandler): void {
    this.addRoute('PUT', path, handler);
  }

  patch(path: string, handler: RouteHandler): void {
    this.addRoute('PATCH', path, handler);
  }

  delete(path: string, handler: RouteHandler): void {
    this.addRoute('DELETE', path, handler);
  }

  route(prefix: string, subrouter: Router): void {
    this.subrouters.set(prefix, subrouter);
  }

  async handle(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method as HttpMethod;

    // Check subrouters first
    for (const [prefix, subrouter] of this.subrouters) {
      if (url.pathname.startsWith(prefix)) {
        // Rewrite URL to remove prefix for subrouter
        const subUrl = new URL(request.url);
        subUrl.pathname = url.pathname.slice(prefix.length) || '/';
        const subRequest = new Request(subUrl.toString(), request);
        return subrouter.handle(subRequest, env, ctx);
      }
    }

    // Check direct routes
    for (const route of this.routes) {
      if (route.method !== method) continue;

      const match = route.pattern.exec(url);
      if (match) {
        const params = match.pathname.groups as Record<string, string>;
        return route.handler(request, env, ctx, params);
      }
    }

    // 404 Not Found
    return Response.json(
      {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Route ${method} ${url.pathname} not found`,
        },
      },
      { status: 404 }
    );
  }
}
