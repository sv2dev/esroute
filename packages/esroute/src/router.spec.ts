import { beforeEach, describe, expect, it, vi } from "vitest";
import { NavOpts } from "./nav-opts";
import { Router, createRouter } from "./router";

describe("Router", () => {
  const onResolve = vi.fn();
  let router: Router<any>;
  beforeEach(() => {
    vi.spyOn(history, "replaceState");
    vi.spyOn(history, "pushState");
    router = createRouter({
      routes: {
        "": ({}, next) => next ?? "index",
        foo: () => "foo",
        fail: () => Promise.reject(),
      },
    });
  });

  describe("init()", () => {
    it("should subscribe to popstate and anchor click events", async () => {
      router.onResolve(onResolve);
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
      router.onResolve(onResolve);
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
      await router.go("/foo");

      expect(history.pushState).toHaveBeenCalledWith(null, "", "/foo");
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
  });

  describe("onResolve()", () => {
    it("should initially call listener, if there is already a current resolution", async () => {
      await router.go("/foo");

      router.onResolve(onResolve);

      expect(onResolve).toHaveBeenNthCalledWith(1, {
        value: "foo",
        opts: expect.objectContaining(new NavOpts("foo")),
      });
    });

    it("should call the listener when a navigation has finished", async () => {
      await router.go("/foo");
      router.onResolve(onResolve);

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
});
