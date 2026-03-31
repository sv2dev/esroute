import { NavMeta, NavOpts, PathOrHref, StrictNavMeta } from "./nav-opts";
import { Resolved, resolve } from "./route-resolver";
import { Resolve, Routes, RoutePaths, RawRoutes } from "./routes";

export type OnResolveListener<T, S = any> = (resolved: Resolved<T, S>) => void;
export interface Router<T = any, S = any, R extends RawRoutes = RawRoutes> {
  /**
   * The routes configuration.
   * You may modify this object to change the routes.
   * Be sure to call `router.init()` after the current route is configured.
   */
  routes: Routes<T, S>;
  /**
   * The current resolved route.
   * It is updated after each route resolution.
   */
  readonly current: NavOpts<S>;
  /**
   * Triggers a navigation.
   * You can modify the navigation options by passing in a second argument.
   * Returns a promise that resolves when the navigation is complete.
   * @param target Can be one of number, array of path parts, a relative url, a NavOpts object or a
   *   function that derives new NavOpts from the current NavOpts.
   *   If it is a number, it is forwarded to history.go().
   *   Use function to patch state, it uses replaceState() and keeps path, search and state
   *   by default.
   * @param opts The navigation metadata.
   */
  go(
    target: number | StrictNavMeta<S> | ((prev: NavOpts<S>) => NavMeta<S>)
  ): Promise<void>;
  go(target: number | RoutePaths<R> | string[], opts?: NavMeta<S>): Promise<void>;
  /**
   * Use this to listen for route changes.
   * Returns an unsubscribe function.
   * @param listener The listener that receives a Resolved object.
   */
  onResolve(listener: OnResolveListener<T, S>): () => void;
  /**
   * Initializes the router: Starts listening for events, resolves the current
   * route and calls the `onResolve` listeners.
   */
  init(): void;
  /**
   * Stops listening for events.
   */
  dispose(): void;
  /**
   * Use this to wait for the current navigation to complete.
   */
  resolution?: Promise<Resolved<T, S>>;
  /**
   * Use this to render the current route (history and location).
   * @param defer A function that defers rendering and can be used to trigger multiple successive
   * navigations without intermediate rendering.
   */
  render(defer?: () => Promise<void>): Promise<void>;
}

export interface RouterConf<T = any, S = any, R extends RawRoutes = RawRoutes> {
  /**
   * The routes configuration. You can modify this object later.
   * Make sure, the current route is in place before you call `router.init()`.
   */
  routes?: R & Routes<T, S>;
  /**
   * A fallback resolve funuction to use, if a route could not be found.
   * By default it redirects to the root path '/'.
   */
  notFound?: Resolve<T, S>;
  /**
   * Whether the click handler for anchor elements shall not be installed.
   * This might make sense, if you want to take more control over how anchor
   * clicks are handled.
   */
  noClick?: boolean;
  /**
   * A callback that is invoked whenever a route is resolved.
   */
  onResolve?: OnResolveListener<T, S>;
}

export const createRouter = <T = any, S = any, R extends RawRoutes = RawRoutes>({
  routes = {} as R & Routes<T, S>,
  notFound = ({ go }) => go([]),
  noClick = false,
  onResolve,
}: RouterConf<T, S, R> = {}): Router<T, S, R> => {
  let _current: Resolved<T, S>;
  const _listeners = new Set<OnResolveListener<T, S>>(
    onResolve ? [onResolve] : []
  );
  let resolution: Promise<Resolved<T, S>>;
  let skipRender = false;
  const r: Router<T, S, R> = {
    routes,
    get current() {
      return _current.opts;
    },
    get resolution() {
      return resolution;
    },
    async init() {
      window.addEventListener("popstate", popStateListener);
      if (!noClick) document.addEventListener("click", linkClickListener);
      await resolveCurrent();
    },
    dispose() {
      window.removeEventListener("popstate", popStateListener);
      document.removeEventListener("click", linkClickListener);
    },
    async go(
      target:
        | number
        | StrictNavMeta<S>
        | ((prev: NavOpts<S>) => NavMeta<S>)
        | RoutePaths<R>
        | PathOrHref,
      opts?: NavMeta<S>
    ): Promise<void> {
      // Serialize all navigaton requests
      const prevRes = await this.resolution;
      let resolvedTarget: any = target;

      if (typeof resolvedTarget === "function") {
        if (!prevRes)
          throw new Error(
            "Cannot call go() with a function before the first navigation has been started."
          );
        resolvedTarget = {
          path: prevRes.opts.path,
          search: prevRes.opts.search,
          state: prevRes.opts.state,
          replace: true,
          ...resolvedTarget(prevRes.opts),
        };
      }

      if (typeof resolvedTarget === "number") {
        const waiting = waitForPopState();
        history.go(resolvedTarget);
        await waiting;
        if (skipRender || opts?.skipRender) return;
        return resolveCurrent();
      }

      const navOpts =
        resolvedTarget instanceof NavOpts
          ? resolvedTarget
          : typeof resolvedTarget === "string" || Array.isArray(resolvedTarget)
          ? new NavOpts<S>(resolvedTarget as PathOrHref, opts)
          : new NavOpts<S>(resolvedTarget as StrictNavMeta<S>);
      if (navOpts.skipRender || skipRender) return updateState(navOpts);
      const res = await applyResolution(resolve(r.routes, navOpts, notFound));
      updateState(res.opts);
    },
    onResolve(listener: OnResolveListener<T, S>) {
      _listeners.add(listener);
      if (_current) listener(_current);
      return () => _listeners.delete(listener);
    },
    async render(defer?: () => Promise<void>) {
      if (!defer) return resolveCurrent();
      skipRender = true;
      try {
        await defer();
      } finally {
        skipRender = false;
      }
      await resolveCurrent();
    },
  };

  const popStateListener = (e: PopStateEvent) => {
    if (skipRender) return;
    resolveCurrent(e);
  };

  const linkClickListener = (e: MouseEvent) => {
    const target = isAnchorElement(e.target)
      ? e.target
      : e.composedPath?.().find(isAnchorElement);
    if (target && target.origin === location.origin) {
      r.go(target.href.substring(location.origin.length) as RoutePaths<R>, {
        replace: "replace" in target.dataset,
      });
      e.preventDefault();
    }
  };

  const resolveCurrent = async (e?: PopStateEvent) => {
    const { href, origin } = window.location;

    const initialOpts = new NavOpts<S>(href.substring(origin.length), {
      state: e ? e.state : history.state,
      pop: !!e,
    });
    const { opts } = await applyResolution(
      resolve(r.routes, initialOpts, notFound)
    );

    if (opts !== initialOpts) {
      updateState(
        new NavOpts<S>(opts.path, {
          replace: true,
          search: opts.search,
          state: opts.state,
        })
      );
    }
  };

  const applyResolution = async (res: Promise<Resolved<T, S>>) => {
    resolution = res;
    try {
      const resolved = await res;
      _listeners.forEach((l) => l(resolved));
      return (_current = resolved);
    } catch (e) {
      resolution = Promise.resolve(_current);
      throw e;
    }
  };

  const updateState = ({ state, replace, href }: NavOpts<S>) => {
    if (replace) history.replaceState(state ?? null, "", href);
    else history.pushState(state ?? null, "", href);
  };

  const waitForPopState = () => {
    return new Promise<PopStateEvent>((r) =>
      window.addEventListener("popstate", r, { once: true })
    );
  };

  return r;
};

const isAnchorElement = (
  target: EventTarget | null
): target is HTMLAnchorElement => target instanceof HTMLAnchorElement;
