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

// Depth counter using a string to track recursion depth
type Inc<T extends string> = `${T}x`;
type IsMaxDepth<T extends string> = T extends `${"x" | "xx" | "xxx" | "xxxx" | "xxxxx" | "xxxxxx" | "xxxxxxx" | "xxxxxxxx" | "xxxxxxxxx" | "xxxxxxxxxx"}` ? true : false;

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
          : `${Prefix}/`
        : K extends "*"
        ? R[K] extends RawRoutes
          ? RoutePaths<R[K], `${Prefix}/${string}`, Inc<D>>
          : `${Prefix}/${string}`
        : R[K] extends RawRoutes
        ? RoutePaths<R[K], `${Prefix}/${K}`, Inc<D>>
        : `${Prefix}/${K}`;
    }[keyof R & string];
