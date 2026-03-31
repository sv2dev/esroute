import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { NavOpts } from "./nav-opts";
import { Routes } from "./routes";
import { createRouter } from "./router";

// Define routes with proper typing to verify RoutePaths inference
// Note: "fail" route is included for testing error handling
const routes = {
  "": ({}, next: string | undefined) => next ?? "index",
  foo: () => "foo",
  fail: () => Promise.reject(new Error("test")),
  bar: () => "bar",
  x: {
    "": ({ state }: NavOpts<{ a: boolean }>) => (state?.a ? "b" : "c"),
    y: () => "x",
  },
} satisfies Routes<string>;

describe("Router", () => {
  let onResolve: Mock;
  let router: ReturnType<typeof createRouter<string, any, typeof routes>>;
  beforeEach(() => {
    onResolve = vi.fn();
    vi.spyOn(history, "replaceState");
    vi.spyOn(history, "pushState");
    vi.spyOn(history, "go").mockImplementation(() =>
      setTimeout(() => window.dispatchEvent(new PopStateEvent("popstate")), 0),
    );
    router = createRouter({
      onResolve,
      routes,
    });
  });

  describe("init()", () => {
    it("should subscribe to popstate and anchor click events", async () => {
      router.init();
      location.href = "http://localhost/foo";

      window.dispatchEvent(new PopStateEvent("popstate"));
      await new Promise((resolve) => setTimeout(resolve, 0));
      await router.resolution;

      expect(onResolve).toHaveBeenCalledWith({
        value: "foo",
        opts: expect.any(NavOpts),
      });
    });

    it("should subscribe to popstate and anchor click events", async () => {
      router.init();
      const anchor = document.createElement("a");
      document.body.appendChild(anchor);
      anchor.href = "http://localhost/foo";
      vi.spyOn(location, "origin", "get").mockReturnValue("http://localhost");

      anchor.click();
      // await router.resolution;
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(onResolve).toHaveBeenLastCalledWith({
        value: "foo",
        opts: expect.any(NavOpts),
      });
    });
  });

  describe("go()", () => {
    it("should navigate to route and push state", async () => {
      await router.go("/x/y");

      expect(history.pushState).toHaveBeenCalledWith(null, "", "/x/y");
    });

    it("should replace the state, if replace flag is set", async () => {
      await router.go("/foo", { replace: true });

      expect(history.replaceState).toHaveBeenCalledWith(null, "", "/foo");
    });

    it("should replace the state, if replace flag is set with NavMeta", async () => {
      await router.go({ path: ["foo"], replace: true });

      expect(history.replaceState).toHaveBeenCalledWith(null, "", "/foo");
    });

    it("should stay on the same route and not block further routing, if resolution fails", async () => {
      await router.go({ path: ["foo"], replace: true });
      try {
        await router.go({ path: ["fail"], replace: true });
      } catch {}
      await router.go({ path: [""], replace: true });

      expect(history.replaceState).toHaveBeenCalledWith(null, "", "/foo");
      expect(history.replaceState).not.toHaveBeenCalledWith(null, "", "/fail");
      expect(history.replaceState).toHaveBeenCalledWith(null, "", "/");
    });

    it("should replace the state by default, if target is a mapping funciton", async () => {
      await router.go("/foo", { search: { a: "b" } });
      await router.go(() => ({ search: { a: "c" } }));

      expect(history.replaceState).toHaveBeenCalledWith(null, "", "/foo?a=c");
    });

    it("should skip rendering, if specified by the NavMeta", async () => {
      await router.go("/foo", { skipRender: true });

      expect(history.pushState).toHaveBeenCalledWith(null, "", "/foo");
      expect(onResolve).not.toHaveBeenCalled();
    });

    it("should render only once, if render is called with defer function", async () => {
      await router.render(async () => {
        await router.go(["baz"]);
        await router.go(-1);
        await router.go("/foo");
      });

      expect(history.pushState).toHaveBeenCalledTimes(2);
      expect(history.go).toHaveBeenCalledTimes(1);
      expect(onResolve).toHaveBeenCalledWith({
        opts: new NavOpts("/foo", { pop: false }),
        value: "foo",
      });
    });

    it("should forward to history.go(), if target is a number", async () => {
      await router.go(1);

      expect(history.go).toHaveBeenCalledWith(1);
      expect(history.go).toHaveBeenCalledTimes(1);
      expect(onResolve).toHaveBeenCalledTimes(1);
    });
  });

  describe("onResolve()", () => {
    it("should initially call listener, if there is already a current resolution", async () => {
      await router.go("/foo");

      expect(onResolve).toHaveBeenNthCalledWith(1, {
        value: "foo",
        opts: expect.objectContaining(new NavOpts("foo")),
      });
    });

    it("should call the listener when a navigation has finished", async () => {
      await router.go("/foo");

      await router.go("/foo");

      expect(onResolve).toHaveBeenNthCalledWith(2, {
        value: "foo",
        opts: expect.objectContaining(new NavOpts("foo")),
      });
    });

    it("should return an unsubscribe callback", async () => {
      const unsubscribe = router.onResolve(onResolve);

      unsubscribe();

      await router.go("/foo");
      expect(onResolve).not.toHaveBeenCalledWith({
        value: "foo",
        opts: expect.objectContaining(new NavOpts("foo")),
      });
    });
  });

  describe("type safety", () => {
    it("should allow valid typed paths", async () => {
      router.init();
      // These should all compile without type errors and accept valid paths
      // The paths "/" | "/foo" | "/bar" | "/fail" are properly typed from the routes
      await router.go("/foo");
      await router.go("/bar");
    });

    it("should work with NavOpts objects", async () => {
      router.init();
      // Type-safe NavOpts construction with proper typing
      const opts = new NavOpts("/foo");
      await router.go(opts);
    });

    it("should work with string array paths", async () => {
      router.init();
      // String arrays should still work alongside typed string paths
      await router.go(["foo"]);
      await router.go(["bar"]);
    });

    it("should require state when the route handler declares a required state type", async () => {
      router.init();
      // /x requires state: { a: boolean } — omitting state is a type error (see go() test above)
      // Providing the required state is valid:
      await router.go("/x", { state: { a: true } });
    });
  });
});
