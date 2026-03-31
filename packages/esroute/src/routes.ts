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

export type RoutePaths<R extends RawRoutes, Prefix extends string = ""> = {
  [K in keyof R & string]: K extends "?"
    ? never
    : K extends ""
    ? R[K] extends RawRoutes
      ? RoutePaths<R[K], Prefix>
      : `${Prefix}/`
    : K extends "*"
    ? R[K] extends RawRoutes
      ? RoutePaths<R[K], `${Prefix}/${string}`>
      : `${Prefix}/${string}`
    : R[K] extends RawRoutes
    ? RoutePaths<R[K], `${Prefix}/${K}`>
    : `${Prefix}/${K}`;
}[keyof R & string];
