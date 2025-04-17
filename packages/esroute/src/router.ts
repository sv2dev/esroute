import { NavMeta, NavOpts, PathOrHref, StrictNavMeta } from "./nav-opts";
import { Resolved, resolve } from "./route-resolver";
import { Resolve, Routes } from "./routes";

export type OnResolveListener<T> = (resolved: Resolved<T>) => void;
export interface Router<T = any> {
  /**
   * The routes configuration.
   * You may modify this object to change the routes.
   * Be sure to call `router.init()` after the current route is configured.
   */
  routes: Routes<T>;
  /**
   * The current resolved route.
   * It is updated after each route resolution.
   */
  readonly current: NavOpts;
  /**
   * Triggers a navigation.
   * You can modify the navigation options by passing in a second argument.
   * Returns a promise that resolves when the navigation is complete.
   * @param target Can be one of array of path parts, a relative url, a NavOpts object or a
   *   function that derives new NavOpts from the current NavOpts.
   *   Use function to patch state, it uses replaceState() and keeps path, search and state
   *   by default.
   * @param opts The navigation metadata.
   */
  go(target: StrictNavMeta | ((prev: NavOpts) => NavMeta)): Promise<void>;
  go(target: PathOrHref, opts?: NavMeta): Promise<void>;
  /**
   * Use this to listen for route changes.
   * Returns an unsubscribe function.
   * @param listener The listener that receives a Resolved object.
   */
  onResolve(listener: OnResolveListener<T>): () => void;
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
  resolution?: Promise<Resolved<T>>;
}

export interface RouterConf<T = any> {
  /**
   * The routes configuration. You can modify this object later.
   * Make sure, the current route is in place before you call `router.init()`.
   */
  routes?: Routes<T>;
  /**
   * A fallback resolve funuction to use, if a route could not be found.
   * By default it redirects to the root path '/'.
   */
  notFound?: Resolve<T>;
  /**
   * Whether the click handler for anchor elements shall not be installed.
   * This might make sense, if you want to take more control over how anchor
   * clicks are handled.
   */
  noClick?: boolean;
  /**
   * A callback that is invoked whenever a route is resolved.
   */
  onResolve?: OnResolveListener<T>;
}

export const createRouter = <T = any>({
  routes = {},
  notFound = ({ go }) => go([]),
  noClick = false,
  onResolve,
}: RouterConf<T> = {}): Router<T> => {
  let _current: Resolved<T>;
  const _listeners = new Set<OnResolveListener<T>>(
    onResolve ? [onResolve] : []
  );
  let resolution: Promise<Resolved<T>>;
  const r: Router<T> = {
    routes,
    get current() {
      return _current.opts;
    },
    get resolution() {
      return resolution;
    },
    init() {
      window.addEventListener("popstate", stateFromHref);
      if (!noClick) document.addEventListener("click", linkClickListener);
      stateFromHref({ state: history.state });
    },
    dispose() {
      window.removeEventListener("popstate", stateFromHref);
      document.removeEventListener("click", linkClickListener);
    },
    async go(
      target: PathOrHref | StrictNavMeta | ((prev: NavOpts) => NavMeta),
      opts?: NavMeta
    ): Promise<void> {
      // Serialize all navigaton requests
      const prevRes = await this.resolution;
      if (typeof target === "function") {
        if (!prevRes)
          throw new Error(
            "Cannot call go() with a function before the first navigation has been started."
          );
        target = {
          path: prevRes.opts.path,
          search: prevRes.opts.search,
          state: prevRes.opts.state,
          replace: true,
          ...target(prevRes.opts),
        };
      }
      const navOpts =
        target instanceof NavOpts
          ? target
          : typeof target === "string" || Array.isArray(target)
          ? new NavOpts(target, opts)
          : new NavOpts(target);
      const res = await applyResolution(resolve(r.routes, navOpts, notFound));
      updateState(res.opts);
    },
    onResolve(listener: OnResolveListener<T>) {
      _listeners.add(listener);
      if (_current) listener(_current);
      return () => _listeners.delete(listener);
    },
  };

  const linkClickListener = (e: MouseEvent) => {
    const target = isAnchorElement(e.target)
      ? e.target
      : e.composedPath?.().find(isAnchorElement);
    if (target && target.origin === location.origin) {
      r.go(target.href.substring(location.origin.length), {
        replace: "replace" in target.dataset,
      });
      e.preventDefault();
    }
  };

  const stateFromHref = async (e: { state: any } | PopStateEvent) => {
    const { href, origin } = window.location;

    const initialOpts = new NavOpts(href.substring(origin.length), {
      state: e.state,
      ...(e instanceof PopStateEvent && { pop: true }),
    });
    const { opts } = await applyResolution(
      resolve(r.routes, initialOpts, notFound)
    );

    if (opts !== initialOpts) {
      updateState(
        new NavOpts(opts.path, {
          replace: true,
          search: opts.search,
          state: opts.state,
        })
      );
    }
  };

  const applyResolution = async (res: Promise<Resolved<T>>) => {
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

  const updateState = ({ state, replace, href }: NavOpts) => {
    if (replace) history.replaceState(state ?? null, "", href);
    else history.pushState(state ?? null, "", href);
  };

  return r;
};

const isAnchorElement = (
  target: EventTarget | null
): target is HTMLAnchorElement => target instanceof HTMLAnchorElement;
