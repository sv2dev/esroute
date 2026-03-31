import { NavOpts } from "./nav-opts";
import { Resolve, Routes } from "./routes";

export interface Resolved<T, S = any> {
  /** The resolved value of the route. */
  value: T;
  /** The final navigation options after all redirecting. */
  opts: NavOpts<S>;
}

export type RouteResolver<T, S = any> = (
  routes: Routes<T, S>,
  opts: NavOpts<S>,
  notFound: Resolve<T, S>
) => Promise<Resolved<T, S>>;

const MAX_REDIRECTS = 10;

export const resolve = async <T, S = any>(
  routes: Routes<T, S>,
  opts: NavOpts<S>,
  notFound: Resolve<T, S>
): Promise<Resolved<T, S>> => {
  let value: NavOpts | T = opts;
  const navPath = new Array<NavOpts>();
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
  root: Routes,
  opts: NavOpts
): Promise<Resolve[] | null> => {
  const { path, params } = opts;
  const resolves: Resolve[] = [];
  let routes: Routes | Resolve | null = root;
  for (let i = 0; i < path.length; i++) {
    const part = path[i];
    if (!routes || typeof routes === "function") return null;
    const redirect = await checkGuard(routes, opts);
    if (redirect) return [() => redirect];
    if (typeof routes["?"] === "function") {
      const guardResult = await routes["?"](opts);
      if (guardResult instanceof NavOpts) return [() => guardResult];
    }
    const virtual: Routes | Resolve | void = routes[""];
    if (typeof virtual === "function") resolves.unshift(virtual);
    if (part in routes) routes = routes[part];
    else if ("*" in routes) {
      params.push(part);
      routes = routes["*"];
    } else if (typeof virtual === "object") {
      routes = virtual;
      i--;
    }
  }
  do {
    if (typeof routes === "function") {
      resolves.unshift(routes);
      return resolves;
    }
    const redirect = await checkGuard(routes, opts);
    if (redirect) return [() => redirect];
  } while ((routes = routes[""]));
  return null;
};

const checkGuard = async (routes: Routes, opts: NavOpts) => {
  if (typeof routes["?"] === "function") {
    const guardResult = await routes["?"](opts);
    if (guardResult instanceof NavOpts) return guardResult;
  }
};
