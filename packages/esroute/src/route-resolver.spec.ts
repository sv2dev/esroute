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

  describe("guards", () => {
    const guard = vi.fn();
    const index = vi.fn();

    it("should resolve routes with guard returning anything but NavOpts", async () => {
      const routes: Routes = { "?": guard, "": index };
      guard.mockResolvedValue(true);

      await resolve(routes, new NavOpts("/"), notFound);

      expect(guard).toHaveBeenCalled();
      expect(index).toHaveBeenCalled();
    });

    it("should redirect, if a guard returns NavOpts", async () => {
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
