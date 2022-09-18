import { Router } from "esroute";
import { html, render } from "lit";
import { beforeEach, describe, expect, it } from "vitest";
import { renderRoutes } from "./render-routes-directive";

const router = new Router<any>({
  "": async ({}, next) => next ?? html`test`,
  foo: async () => html`foo`,
  bar: {
    "": async ({}, next) => `bar ${next}`,
    baz: async () => `baz`,
  },
});

describe("renderRoutes directive", () => {
  it("should throw an error, if not used as a child directive", async () => {
    expect(() =>
      render(html`<div ${renderRoutes(router)}></div>`, document.body)
    ).toThrow(
      "The `renderRoutes` directive must be used as a child directive."
    );
  });

  describe("rendering routes", () => {
    beforeEach(() => {
      render(html``, document.body);
      render(html`${renderRoutes(router)}`, document.body);
    });

    it("should render a route", async () => {
      await router.go("/foo");

      expect(document.body.innerHTML).toContain("foo");
    });

    it("should render nested routes", async () => {
      await router.go("/bar/baz");

      expect(document.body.innerHTML).toContain("bar baz");
    });
  });
});
