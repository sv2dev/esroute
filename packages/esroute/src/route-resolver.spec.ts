import { describe, expect, it, vi } from "vitest";
import { NavOpts } from "./nav-opts";
import { resolve } from "./route-resolver";
import { Routes } from "./routes";

describe("Resolver", () => {
  const notFound = vi.fn();

  describe("resolution", () => {
    it("should resolve a route with resolve fn", async () => {
      const navOpts = new NavOpts("/foo/bar");

      const { value, opts } = await resolve(
        { foo: { bar: () => "foobar" } },
        navOpts,
        notFound
      );

      expect(value).toEqual("foobar");
      expect(opts).toBe(navOpts);
    });

    it("should resolve a route with resolve fn on '/'", async () => {
      const navOpts = new NavOpts("/foo/bar");

      const { value, opts } = await resolve(
        { foo: { bar: { "": () => "bar" } } },
        navOpts,
        notFound
      );

      expect(value).toEqual("bar");
      expect(opts).toBe(navOpts);
    });
  });

  describe("virtual routes", () => {
    const index = vi.fn();

    it("should resolve index routes", async () => {
      const routes: Routes = { "": index };

      await resolve(routes, new NavOpts("/"), notFound);

      expect(index).toHaveBeenCalled();
    });

    it("should resolve index route nested in virtual routes", async () => {
      const routes: Routes = { foo: { "": { "": index } } };

      await resolve(routes, new NavOpts("/foo"), notFound);

      expect(index).toHaveBeenCalled();
    });

    it("should resolve index route nested in virtual routes at /", async () => {
      const routes: Routes = { "": { "": index } };

      await resolve(routes, new NavOpts("/"), notFound);

      expect(index).toHaveBeenCalled();
    });

    it("should not resolve sibling virtual routes", async () => {
      const foo = vi.fn();
      const routes: Routes = { "": { "": index }, foo };

      await resolve(routes, new NavOpts("/foo"), notFound);

      expect(index).not.toHaveBeenCalled();
      expect(foo).toHaveBeenCalled();
    });

    it("should pass on ancestors to index routes", async () => {
      const routes: Routes = {
        "": index,
        foo: () => "foo",
        bar: { baz: () => "bar/baz" },
      };

      await resolve(routes, new NavOpts("/foo"), notFound);
      await resolve(routes, new NavOpts("/bar/baz"), notFound);

      expect(index).toHaveBeenNthCalledWith(1, expect.anything(), "foo");
      expect(index).toHaveBeenNthCalledWith(2, expect.anything(), "bar/baz");
    });

    it("should resolve named routes within virtual routes", async () => {
      const foo = vi.fn();
      const routes: Routes = { "": { "": { foo } } };

      await resolve(routes, new NavOpts("/foo"), notFound);

      expect(foo).toHaveBeenCalled();
    });

    it("should add params to NavOpts", async () => {
      const baz = vi.fn();
      const routes: Routes = { foo: { "*": { baz } } };
      const opts = new NavOpts("/foo/bar/baz");

      await resolve(routes, opts, notFound);

      expect(baz).toHaveBeenCalled();
      expect(opts.params).toEqual(["bar"]);
    });
  });

  describe("not found", () => {
    it("should not resolve /x/y when only /y exists", async () => {
      const y = vi.fn(() => "y");
      const routes: Routes = { y };

      const { value } = await resolve(routes, new NavOpts("/x/y"), notFound);

      expect(y).not.toHaveBeenCalled();
      expect(notFound).toHaveBeenCalled();
    });

    it("should not resolve /y when only /x/y exists", async () => {
      const xy = vi.fn(() => "xy");
      const routes: Routes = { x: { y: xy } };

      const { value } = await resolve(routes, new NavOpts("/y"), notFound);

      expect(xy).not.toHaveBeenCalled();
      expect(notFound).toHaveBeenCalled();
    });

    it("should not skip intermediate unmatched segments", async () => {
      const baz = vi.fn(() => "baz");
      const routes: Routes = { foo: { bar: { baz } } };

      await resolve(routes, new NavOpts("/foo/unknown/baz"), notFound);

      expect(baz).not.toHaveBeenCalled();
      expect(notFound).toHaveBeenCalled();
    });

    it("should call notFound for completely unknown paths", async () => {
      const routes: Routes = { foo: () => "foo" };

      await resolve(routes, new NavOpts("/bar"), notFound);

      expect(notFound).toHaveBeenCalled();
    });

    it("should call notFound when path is longer than route tree", async () => {
      const foo = vi.fn(() => "foo");
      const routes: Routes = { foo };

      await resolve(routes, new NavOpts("/foo/bar"), notFound);

      expect(foo).not.toHaveBeenCalled();
      expect(notFound).toHaveBeenCalled();
    });
  });

  describe("guards", () => {
    it("should resolve routes with guard returning anything but NavOpts", async () => {
      const guard = vi.fn().mockResolvedValue(true);
      const index = vi.fn();
      const routes: Routes = { "?": guard, "": index };

      await resolve(routes, new NavOpts("/"), notFound);

      expect(guard).toHaveBeenCalled();
      expect(index).toHaveBeenCalled();
    });

    it("should redirect, if a guard returns NavOpts", async () => {
      const guard = vi.fn();
      const index = vi.fn();
      const routes: Routes = {
        foo: { "?": guard, "": index },
        bar: () => "foo",
      };
      guard.mockImplementation(({ go }) => go("/bar"));

      const resolved = await resolve(routes, new NavOpts("/foo"), notFound);

      expect(guard).toHaveBeenCalled();
      expect(index).not.toHaveBeenCalled();
      expect(resolved.value).toEqual("foo");
    });

    it("should call guard only once per level during traversal", async () => {
      const guard = vi.fn().mockResolvedValue(true);
      const handler = vi.fn(() => "result");
      const routes: Routes = { "?": guard, foo: handler };

      await resolve(routes, new NavOpts("/foo"), notFound);

      expect(guard).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalled();
    });

    it("should check guards at each level of nested routes", async () => {
      const rootGuard = vi.fn().mockResolvedValue(true);
      const fooGuard = vi.fn().mockResolvedValue(true);
      const handler = vi.fn(() => "result");
      const routes: Routes = {
        "?": rootGuard,
        foo: { "?": fooGuard, bar: handler },
      };

      await resolve(routes, new NavOpts("/foo/bar"), notFound);

      expect(rootGuard).toHaveBeenCalledTimes(1);
      expect(fooGuard).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalled();
    });

    it("should short-circuit on guard redirect at intermediate level", async () => {
      const rootGuard = vi.fn().mockResolvedValue(true);
      const fooGuard = vi
        .fn()
        .mockImplementation(({ go }) => go("/other"));
      const handler = vi.fn(() => "result");
      const other = vi.fn(() => "other");
      const routes: Routes = {
        "?": rootGuard,
        foo: { "?": fooGuard, bar: handler },
        other,
      };

      const { value } = await resolve(
        routes,
        new NavOpts("/foo/bar"),
        notFound
      );

      expect(rootGuard).toHaveBeenCalled();
      expect(fooGuard).toHaveBeenCalled();
      expect(handler).not.toHaveBeenCalled();
      expect(value).toEqual("other");
    });
  });

  describe("wildcards", () => {
    it("should collect multiple wildcard params", async () => {
      const handler = vi.fn();
      const routes: Routes = { "*": { "*": handler } };
      const opts = new NavOpts("/a/b");

      await resolve(routes, opts, notFound);

      expect(handler).toHaveBeenCalled();
      expect(opts.params).toEqual(["a", "b"]);
    });

    it("should prefer exact match over wildcard", async () => {
      const exact = vi.fn(() => "exact");
      const wild = vi.fn(() => "wild");
      const routes: Routes = { foo: exact, "*": wild };
      const opts = new NavOpts("/foo");

      const { value } = await resolve(routes, opts, notFound);

      expect(value).toEqual("exact");
      expect(wild).not.toHaveBeenCalled();
    });

    it("should use wildcard for unmatched segments", async () => {
      const wild = vi.fn(() => "wild");
      const routes: Routes = { foo: () => "foo", "*": wild };
      const opts = new NavOpts("/bar");

      const { value } = await resolve(routes, opts, notFound);

      expect(value).toEqual("wild");
      expect(opts.params).toEqual(["bar"]);
    });
  });

  describe("types", () => {
    it("should not allow a route object as guard", () => {
      // @ts-expect-error "?" must be a function, not a sub-routes object
      const _routes: Routes = { "?": { foo: () => "foo" } };
    });

    it("should allow a function as guard", () => {
      const _routes: Routes = { "?": () => undefined };
    });
  });

  describe("redirects", () => {
    it("should resolve a redirect via calling 'go()'", async () => {
      const navOpts = new NavOpts("/foo");

      const { value, opts } = await resolve(
        { foo: ({ go }) => go("/bar"), bar: () => "bar" },
        navOpts,
        notFound
      );

      expect(value).toEqual("bar");
      expect(opts).toEqual(expect.objectContaining(new NavOpts("/bar")));
    });

    it("should fail on too many redirects", async () => {
      const navOpts = new NavOpts<number>("/foo", { state: 1 });

      await expect(
        resolve(
          { foo: ({ go, state }) => go("/foo", { state: (state ?? 0) + 1 }) },
          navOpts,
          notFound
        )
      ).rejects.toEqual(
        new Error(`More than 10 redirects: ${"/foo -> ".repeat(10)}/foo`)
      );
    });
  });
});
