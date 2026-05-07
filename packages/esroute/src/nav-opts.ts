export type PathOrHref = string | string[];

export interface NavMeta<
  S = never,
  Search extends Record<string, string> = Record<never, never>
> {
  /** The search query object. */
  search?: Search;
  /** The state to push. */
  state?: S | null;
  /** The location hash. */
  hash?: string;
  /** Whether the history state shall be replaced. */
  replace?: boolean;
  /** Whether the resolution was triggered by a popstate event. */
  pop?: boolean;
  /** The path to resolve. */
  path?: string[];
  /** The href to resolve. Should be relative. */
  href?: string;
  /** Whether the rendering should be skipped. */
  skipRender?: boolean;
}

export type StrictNavMeta<
  S = never,
  Search extends Record<string, string> = Record<never, never>
> = NavMeta<S, Search> &
  (
    | {
        path: string[];
      }
    | {
        href: string;
      }
  );

export class NavOpts<
  S = never,
  Search extends Record<string, string> = Record<never, never>
> implements NavMeta<S, Search> {
  readonly state: S;
  readonly params: string[] = [];
  readonly hash?: string;
  readonly replace?: boolean;
  readonly skipRender?: boolean;
  readonly path: string[];
  readonly search: Search;
  readonly pop?: boolean;
  private _h?: string;

  constructor(target: StrictNavMeta<S, Search>);
  constructor(target: PathOrHref, opts?: NavMeta<S, Search>);
  constructor(
    target: PathOrHref | StrictNavMeta<S, Search>,
    opts: NavMeta<S, Search> = {}
  ) {
    let { path, href, hash, pop, replace, search, state, skipRender } =
      typeof target === "string" || Array.isArray(target) ? opts : target;
    if (path) this.path = path;
    else if (href || typeof target === "string") {
      href ??= target as string;
      if (!href.startsWith("/")) href = `/${href}`;
      if (!search) this._h = href;
      const [, pathString, , searchString, , parsedHash] = href.match(
        /([^?#]+)(\?([^#]+))?(#(.+))?/
      )!;
      this.path = pathString.split("/").filter(Boolean);
      if (searchString)
        this.search = Object.fromEntries(
          new URLSearchParams(searchString).entries()
        ) as Search;
      if (parsedHash) this.hash = parsedHash;
    } else this.path = target as string[];
    if (hash != null) this.hash = hash;
    if (pop != null) this.pop = pop;
    if (search != null) this.search = search;
    this.state = (state ?? null) as S;
    if (replace != null) this.replace = replace;
    if (skipRender != null) this.skipRender = skipRender;
    this.search ??= {} as Search;
  }

  get href() {
    if (!this._h) {
      const s = new URLSearchParams(this.search).toString();
      const p = `/${this.path!.join("/")}`;
      this._h = `${p}${s ? `?${s}` : ""}${this.hash ? `#${this.hash}` : ""}`;
    }
    return this._h;
  }

  get go() {
    return (path: PathOrHref, opts: NavMeta<S, Search> = {}) =>
      new NavOpts<S, Search>(path, {
        search: opts.search,
        state: opts.state,
        replace: opts.replace ?? this.replace,
      });
  }
}
