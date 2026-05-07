import { NavOpts } from "./nav-opts.js";
import { Resolve, Routes } from "./routes.js";

export interface Resolved<
  T,
  S = never,
  Search extends Record<string, string> = Record<never, never>
> {
  /** The resolved value of the route. */
  value: T;
  /** The final navigation options after all redirecting. */
  opts: NavOpts<S, Search>;
}

export type RouteResolver<
  T,
  S = never,
  Search extends Record<string, string> = Record<never, never>
> = (
  routes: Routes<T, S, Search>,
  opts: NavOpts<S, Search>,
  notFound: Resolve<T, S, Search>
) => Promise<Resolved<T, S, Search>>;

const MAX_REDIRECTS = 10;

export const resolve = async <
  T,
  S = never,
  Search extends Record<string, string> = Record<never, never>
>(
  routes: Routes<T, S, Search>,
  opts: NavOpts<S, Search>,
  notFound: Resolve<T, S, Search>
): Promise<Resolved<T, S, Search>> => {
  let value: NavOpts<S, Search> | T = opts;
  const navPath: NavOpts<S, Search>[] = [];
  while (value instanceof NavOpts && navPath.length <= MAX_REDIRECTS) {
    opts = value;
    navPath.push(opts);
    const resolves = (await getResolves(routes, opts)) ?? [notFound];
    for (const resolve of resolves) {
      value = await resolve(opts, value instanceof NavOpts ? undefined : value);
      if (value instanceof NavOpts) break;
    }
  }

  if (navPath.length > MAX_REDIRECTS)
    throw new Error(
      `More than ${MAX_REDIRECTS} redirects: ${navPath
        .map((n) => n.href)
        .join(" -> ")}`
    );

  return { value: value as T, opts };
};

const getResolves = async (
  root: Routes<any, any, any>,
  opts: NavOpts<any, any>
): Promise<Resolve<any, any, any>[] | null> => {
  const { path, params } = opts;
  const resolves: Resolve<any, any, any>[] = [];
  let routes:
    | Routes<any, any, any>
    | Resolve<any, any, any>
    | null
    | undefined = root;
  for (let i = 0; i < path.length; i++) {
    const part = path[i];
    if (!routes || typeof routes === "function") return null;
    const redirect = await checkGuard(routes, opts);
    if (redirect) return [() => redirect];
    const virtual:
      | Routes<any, any, any>
      | Resolve<any, any, any>
      | undefined = routes[""];
    if (typeof virtual === "function") resolves.unshift(virtual);
    if (part in routes) routes = routes[part];
    else if ("*" in routes) {
      params.push(part);
      routes = routes["*"];
    } else if (typeof virtual === "object") {
      routes = virtual;
      i--;
    } else {
      return null;
    }
  }
  do {
    if (typeof routes === "function") {
      resolves.unshift(routes);
      return resolves;
    }
    if (!routes) return null;
    const redirect = await checkGuard(routes, opts);
    if (redirect) return [() => redirect];
  } while ((routes = routes[""]));
  return null;
};

const checkGuard = async (
  routes: Routes<any, any, any>,
  opts: NavOpts<any, any>
) => {
  if (typeof routes["?"] === "function") {
    const guardResult = await routes["?"](opts);
    if (guardResult instanceof NavOpts) return guardResult;
  }
};
