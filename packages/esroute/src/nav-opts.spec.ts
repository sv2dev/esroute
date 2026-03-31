import { describe, expect, it } from "vitest";
import { NavOpts } from "./nav-opts";

describe("NavOpts", () => {
  describe("properties", () => {
    it("should take a path as first argument", () => {
      const path = ["foo", "bar"];
      const opts = new NavOpts(path);

      expect(opts.path).toBe(path);
      expect(opts).toEqual(
        expect.objectContaining({
          href: "/foo/bar",
          path: ["foo", "bar"],
          search: {},
        })
      );
    });

    it("should take an href as first argument", () => {
      const href = "/foo/bar?a=b";
      const opts = new NavOpts(href);

      expect(opts).toEqual(
        expect.objectContaining({
          path: ["foo", "bar"],
          href,
          search: { a: "b" },
        })
      );
    });

    it("should have an empty path, if the root href is passed", () => {
      const href = "/";
      const opts = new NavOpts(href);

      expect(opts).toEqual(
        expect.objectContaining({
          path: [],
        })
      );
    });

    it("should take an object as search option which has higher prio than the search part of the href", () => {
      const href = "/foo/bar?a=b";
      const opts = new NavOpts(href, { search: { a: "c" } });

      expect(opts).toEqual(
        expect.objectContaining({
          href: "/foo/bar?a=c",
          search: { a: "c" },
        })
      );
    });

    it("should not set state and replace from the opts, if not specified", () => {
      const href = "/foo/bar?a=b";
      const opts = new NavOpts(href, {});

      expect(opts.state).toBeNull();
      expect("replace" in opts).toBeFalsy();
    });

    it("should take state and replace from the opts", () => {
      const href = "/foo/bar?a=b";
      const opts = new NavOpts(href, { state: "abc", replace: true });

      expect(opts.state).toEqual("abc");
      expect(opts.replace).toEqual(true);
    });

    it("should take another NavOpts object as first parameter", () => {
      const opts = new NavOpts(
        new NavOpts("/foo/bar?a=b", { state: "abc", replace: true })
      );

      expect(opts.state).toEqual("abc");
      expect(opts.replace).toEqual(true);
      expect(opts.href).toEqual("/foo/bar?a=b");
      expect(opts.search).toEqual({ a: "b" });
      expect(opts.path).toEqual(["foo", "bar"]);
    });

    it("should take an object as first parameter that implements NavOpts", () => {
      const opts = new NavOpts({
        path: ["foo", "bar"],
        state: "abc",
        search: { a: "b" },
        replace: true,
      });

      expect(opts.state).toEqual("abc");
      expect(opts.replace).toEqual(true);
      expect(opts.href).toEqual("/foo/bar?a=b");
      expect(opts.search).toEqual({ a: "b" });
      expect(opts.path).toEqual(["foo", "bar"]);
    });
  });

  describe("go", () => {
    it("should create a new NavigateOpts instance with a new path", () => {
      const opts1 = new NavOpts(["a", "b"]);
      const opts2 = opts1.go("/a");

      expect(opts1).not.toBe(opts2);
      expect(opts2.path).toEqual(["a"]);
    });

    it("should only take over the replace option", () => {
      const opts1 = new NavOpts(["a", "b"], {
        replace: true,
        search: { a: "b" },
        state: {},
      });
      const opts2 = opts1.go("/a");

      expect(opts2.replace).toBe(true);
      expect(opts2.search).toEqual({});
      expect(opts2.state).toBeNull();
    });

    it("should set new options", () => {
      const opts1 = new NavOpts<number>(["a", "b"], {
        replace: true,
      });
      const opts2 = opts1.go("/a", {
        replace: true,
        search: { a: "b" },
        state: 123,
      });

      expect(opts2.replace).toBe(true);
      expect(opts2.search).toEqual({ a: "b" });
      expect(opts2.state).toEqual(123);
    });
  });
});
