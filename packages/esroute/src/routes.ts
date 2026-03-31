import { NavOpts } from "./nav-opts";

export type RawRoutes = {
  [k: string]: RawRoutes | ((...args: any[]) => any);
};

export type Resolve<T = any, S = any> = (
  navOpts: NavOpts<S>,
  next?: T
) => T | NavOpts<S> | Promise<T | NavOpts<S>>;

export interface Routes<T = any, S = any> {
  [k: string]: Routes<T, S> | Resolve<T, S>;
}

// Depth counter using a string to track recursion depth (max 10 levels)
type Inc<T extends string> = `${T}x`;
type IsMaxDepth<T extends string> = T extends "xxxxxxxxxx" ? true : false;

export type RoutePaths<
  R extends RawRoutes,
  Prefix extends string = "",
  D extends string = ""
> = IsMaxDepth<D> extends true
  ? string
  : {
      [K in keyof R & string]: K extends "?"
        ? never
        : K extends ""
        ? R[K] extends RawRoutes
          ? RoutePaths<R[K], Prefix, Inc<D>>
          : Prefix extends "" ? "/" : Prefix
        : K extends "*"
        ? R[K] extends RawRoutes
          ? RoutePaths<R[K], `${Prefix}/${string}`, Inc<D>>
          : `${Prefix}/${string}`
        : R[K] extends RawRoutes
        ? RoutePaths<R[K], `${Prefix}/${K}`, Inc<D>>
        : `${Prefix}/${K}`;
    }[keyof R & string];

// ---- Type-safe navigation helpers ----

type _Split<S extends string, D extends string> =
  S extends `${infer F}${D}${infer R}` ? [F, ..._Split<R, D>] : [S];

type _PathParts<P extends string> =
  P extends "/"
    ? []
    : P extends `/${infer Rest}`
    ? _Split<Rest, "/">
    : _Split<P, "/">;

// Walk the routes tree by path parts to find the leaf handler function
type _NavigateRoutes<R extends RawRoutes, Parts extends string[]> =
  Parts extends []
    ? R[""] extends (...args: any[]) => any
      ? R[""]
      : never
    : Parts extends [infer First extends string, ...infer Rest extends string[]]
    ? First extends keyof R
      ? R[First] extends RawRoutes
        ? _NavigateRoutes<R[First], Rest>
        : Rest extends []
        ? R[First]
        : never
      : never
    : never;

/** Resolves to the route handler function for a given path string. */
export type HandlerFor<R extends RawRoutes, P extends string> = _NavigateRoutes<
  R,
  _PathParts<P>
>;

/**
 * Extracts the state type S from a route handler typed as
 * `(navOpts: NavOpts<S>, ...) => any`.
 */
export type StateOf<F> = F extends (
  navOpts: NavOpts<infer S>,
  ...rest: any[]
) => any
  ? S
  : any;

/**
 * True when the route handler specifies a concrete (non-`any`, non-`unknown`,
 * non-`undefined`) state type, indicating callers must provide `state` when
 * navigating to it.
 *
 * Uses `unknown extends T` which is only true when T is `any` or `unknown`.
 */
export type NeedsState<F> = unknown extends StateOf<F>
  ? false
  : StateOf<F> extends undefined
  ? false
  : true;
