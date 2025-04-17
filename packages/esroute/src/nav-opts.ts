export type PathOrHref = string | string[];

export interface NavMeta {
  /** The search query object. */
  search?: Record<string, string>;
  /** The state to push. */
  state?: any;
  /** The location hash. */
  hash?: string;
  /** Whethe the history state shall be replaced. */
  replace?: boolean;
  /** Whether the resolution was triggered by a popstate event. */
  pop?: boolean;
  /** The path to resolve. */
  path?: string[];
  /** The href to resolve. Should be relative. */
  href?: string;
}

export type StrictNavMeta = NavMeta &
  (
    | {
        path: string[];
      }
    | {
        href: string;
      }
  );

export class NavOpts implements NavMeta {
  readonly state?: any;
  readonly params: string[] = [];
  readonly hash?: string;
  readonly replace?: boolean;
  readonly path: string[];
  readonly search: Record<string, string>;
  readonly pop?: boolean;
  private _h?: string;

  constructor(target: StrictNavMeta);
  constructor(target: PathOrHref, opts?: NavMeta);
  constructor(target: PathOrHref | StrictNavMeta, opts: NavMeta = {}) {
    let { path, href, hash, pop, replace, search, state } =
      typeof target === "string" || Array.isArray(target) ? opts : target;
    if (path) this.path = path;
    else if (href || typeof target === "string") {
      href ??= target as string;
      if (!href.startsWith("/")) href = `/${href}`;
      if (!search) this._h = href;
      const [, pathString, , searchString, , hash] = href.match(
        /([^?#]+)(\?([^#]+))?(#(.+))?/
      )!;
      this.path = pathString.split("/").filter(Boolean);
      if (searchString)
        this.search = Object.fromEntries(
          new URLSearchParams(searchString).entries()
        );
      if (hash) this.hash = hash;
    } else this.path = target as string[];
    if (hash != null) this.hash = hash;
    if (pop != null) this.pop = pop;
    if (search != null) this.search = search;
    if (state != null) this.state = state;
    if (replace != null) this.replace = replace;
    this.search ??= {};
  }

  get href() {
    if (!this._h) {
      const s = new URLSearchParams(this.search).toString();
      const p = `/${this.path!.join("/")}`;
      this._h = `${p}${s ? `?${s}` : ""}`;
    }
    return this._h;
  }

  get go() {
    return (path: PathOrHref, opts: NavMeta = {}) =>
      new NavOpts(path, {
        search: opts.search,
        state: opts.state,
        replace: opts.replace ?? this.replace,
      });
  }
}
