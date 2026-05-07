import { NavMeta, NavOpts } from "./nav-opts.js";

export type RawRoutes = {
  [k: string]: RawRoutes | ((...args: any[]) => any);
};

export interface RouteContract {
  state?: any;
  search?: Record<string, string>;
}

declare const routeContract: unique symbol;

type ContractState<C> = C extends { state?: infer S } ? S : never;
type ContractSearch<C> = C extends {
  search?: infer Search extends Record<string, string>;
}
  ? Search
  : Record<never, never>;

type HasContract<F> = typeof routeContract extends keyof F ? true : false;
type ContractOf<F> = F extends { readonly [routeContract]?: infer C }
  ? C
  : never;
type HasContractState<F> = HasContract<F> extends true
  ? "state" extends keyof ContractOf<F>
    ? true
    : false
  : false;
type HasContractSearch<F> = HasContract<F> extends true
  ? "search" extends keyof ContractOf<F>
    ? true
    : false
  : false;
type FirstArg<F> = F extends (...args: infer Args) => any
  ? Args extends [infer First, ...any[]]
    ? First
    : never
  : never;

export type Resolve<
  T = any,
  S = never,
  Search extends Record<string, string> = Record<never, never>
> = (
  navOpts: NavOpts<S, Search>,
  next?: T
) => T | NavOpts<S, Search> | Promise<T | NavOpts<S, Search>>;

export type Route<
  T = any,
  C extends RouteContract = RouteContract
> = Resolve<T, ContractState<C>, ContractSearch<C>> & {
  readonly [routeContract]?: C;
};

export const route = <C extends RouteContract = {}, T = any>(
  resolve: Resolve<T, ContractState<C>, ContractSearch<C>>
): Route<T, C> => resolve as Route<T, C>;

export interface Routes<
  T = any,
  S = never,
  Search extends Record<string, string> = Record<never, never>
> {
  "?"?: Resolve<T, S, Search>;
  [k: string]: Routes<T, any, any> | Resolve<T, any, any> | undefined;
}

// Depth counter using a string to track recursion depth (max 10 levels)
type Inc<T extends string> = `${T}x`;
type IsMaxDepth<T extends string> = T extends "xxxxxxxxxx" ? true : false;

export type RoutePaths<
  R extends RawRoutes,
  Prefix extends string = "",
  D extends string = ""
> = string extends keyof R
  ? string
  : IsMaxDepth<D> extends true
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
      : "*" extends keyof R
      ? R["*"] extends RawRoutes
        ? _NavigateRoutes<R["*"], Rest>
        : Rest extends []
        ? R["*"]
        : never
      : never
    : never;

/** Resolves to the route handler function for a given path string. */
export type HandlerFor<R extends RawRoutes, P extends string> = string extends keyof R
  ? () => any
  : _NavigateRoutes<R, _PathParts<P>>;

/**
 * Extracts the state type S from either a route() contract or a route handler
 * typed as `(navOpts: NavOpts<S>, ...) => any`.
 */
export type StateOf<F> = HasContract<F> extends true
  ? ContractState<ContractOf<F>>
  : [FirstArg<F>] extends [never]
  ? never
  : [FirstArg<F>] extends [NavOpts<infer S, any>]
  ? S
  : never;

/**
 * Extracts the search type from either a route() contract or a route handler
 * typed as `(navOpts: NavOpts<S, Search>, ...) => any`.
 */
export type SearchOf<F> = HasContract<F> extends true
  ? ContractSearch<ContractOf<F>>
  : [FirstArg<F>] extends [never]
  ? Record<never, never>
  : [FirstArg<F>] extends [
      NavOpts<any, infer Search extends Record<string, string>>
    ]
  ? Search
  : Record<never, never>;

/**
 * True when the route handler specifies a concrete state type, indicating
 * callers must provide `state` when navigating to it.
 *
 * route() contracts require state when the contract contains a `state` key.
 * Legacy NavOpts-typed handlers use `unknown extends T` which is only true
 * when T is `any` or `unknown`.
 */
export type NeedsState<F> = HasContractState<F> extends true
  ? true
  : unknown extends StateOf<F>
  ? false
  : StateOf<F> extends null | undefined
  ? false
  : true;

/** True when a route declares non-empty search metadata. */
export type NeedsSearch<F> = HasContractSearch<F> extends true
  ? true
  : keyof SearchOf<F> extends never
  ? false
  : true;

export type NavMetaFor<F> = Omit<
  NavMeta<StateOf<F>, SearchOf<F>>,
  "state" | "search"
> &
  (NeedsState<F> extends true ? { state: StateOf<F> } : { state?: never }) &
  (NeedsSearch<F> extends true ? { search: SearchOf<F> } : { search?: never });

export type NeedsNavMeta<F> = NeedsState<F> extends true
  ? true
  : NeedsSearch<F> extends true
  ? true
  : false;
