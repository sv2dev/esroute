# esroute

A small efficient framework-agnostic client-side routing library, written in TypeScript.\
[![](https://flat.badgen.net/bundlephobia/minzip/esroute)](https://bundlephobia.com/result?p=esroute)

It is currently under development and API might slightly change.

[Demo](https://stackblitz.com/edit/esroute)

## Features

Those features may be the ones you are looking for.

- [🌈 Framework agnostic](#-framework-agnostic)
- [🧭 Concise navigation API](#-concise-navigation-api)
- [🕹 Simple configuration](#-simple-configuration)
- [✅ Typesafe value resolution](#-typesafe-value-resolution)
- [🏎 Fast startup and runtime](#-fast-startup-and-runtime)
- [🛡 Route guards](#-route-guards)
- [🦄 Virtual routes](#-virtual-routes)
- [⏱️ Deferred rendering](#-deferred-rendering-1)

### 🌈 Framework agnostic

Esroute is written with no external dependencies, so it does not require you to use a library.

### 🧭 Concise navigation API

Navigation with esroute is straight-forward.
There is a `go()` method on the router instance.
Examples:

```ts
// Navigate to some page
router.go("/some/path", { search: { foo: "bar" }, state: 42 });
// Update search params, keeping previous path and state. Will use history.replaceState() by default.
router.go((prev) => ({
  search: { foo: "baz" },
}));
```

#### Wrapped history navigation API

The `go` method is a wrapper around the history navigation API.
You can use it to navigate to a specific history state:

```ts
await router.go(1); // Go one step forward and wait for the popstate event to be dispatched
await router.go(-2); // Go two steps back and wait for the popstate event to be dispatched
```

A difference is that the `go` method will not render the page, if the `skipRender` flag is set.

Additionally, `go` is asynchronous, and in case of history navigation, it will wait for the popstate event to be dispatched.

### 🕹 Simple configuration

A configuration can look as simple as this:

```ts
import { createRouter } from "esroute";

const router = createRouter({
  routes: {
    "": ({ go }, next) => next ?? go("/foo"),
    foo: () => load("routes/foo.html"),
    nested: {
      "": load("routes/nested/index.html"),
      "*": ({ params: [param] }) => load("routes/nested/dynamic.html", param),
    },
  },
});

router.onResolve(({ value }) => render(value));
router.init();
```

You can compose the configuration as you like, which allows you to easily modularize you route configuration:

```ts
const router = createRouter({
  routes: {
    "": ({ go }) => go("/mod1"),
    mod1: mod1Routes,
    merged: {
      ...mod2Routes,
      ...mod3Routes,
    },
  },
});
```

### ✅ Typesafe value resolution

The router can be restricted to allow only certain resolution types.

```ts
const router = createRouter<string>({
  routes: {
    "": () => "some nice value",
    async: loadString(),
    weird: () => 42, // TS Error
  },
});
```

### 🏎 Fast startup and runtime

esroute comes with no dependencies and is quite small.

The route resolution is done by traversing the route spec that is used to configure the app routes (no preprocessing required). The algorithm is based on simple string comparisons (no regex matching).

### 🛡 Route guards

You can prevent resolving routes by redirecting to another route within a guard:

```ts
const router = createRouter({
  routes: {
    members: {
      "?": async ({ go }) => (await isLoggedIn()) || go("/login"),
      ...memberRoutes,
    },
  },
});
```

In the example above, a logged in user will see the profile and a logged-out user will see the login page instead.

Another example:

```ts
const router = createRouter({
  routes: {
    "*": {
      "?": async ({ go, params: [id] }) =>
        (await exists(id)) || go("/not-found"),
      ...someRoutes,
    },
  },
});
```

### 🦄 Virtual routes

When route resolution is done, all virtual routes (`""`) on the path to the leaf are collected and then rendered from leaf to root.

This allows creating various szenarios. Here are some examples:

#### Composed rendering

```ts
const router = createRouter({
  routes: {
    foo: {
      "": ({}, next) => (next ? `foo${next}` : "foo"),
      bar: () => `bar`,
    },
  },
});
```

In this case the route `/foo` will resolve to `"foo"` and the route `/foo/bar` will resolve to `foobar`. With this pattern you can implement index routes and frames.

#### Anonymous grouping of routes

In some cases you might want to attach rendering af a common frame or a guard to a set of routes without placing them on a separate named parent route. This is where virtual routes come into play:

```ts
const router = createRouter({
  routes: {
    "": {
      "": ({ go }, value) => (loggedIn ? value ?? renderIndex() : go("/login")),
      ...memberRoutes,
    },
    login: () => renderLogin(),
  },
});
```

In this sczenario we have the `memberRoutes` next to the `/login` route.

### ⏱️ Deferred rendering

You can defer rendering by passing a function to the `render` method.
This can be useful to trigger multiple successive navigations without intermediate rendering to prevent flickering.

```ts
router.render(async () => {
  await router.go("/foo"); // Will not render the page
  await router.go("/bar"); // Will render the page
});
```

One thing to note is that no guards and render functions will be executed for intermediate navigation.
So any specified guards or redirects within the render functions will only be executed for the last navigation.

You can also defer rendering by passing the `skipRender` option to the `go` method.

This is equivalent to the code above:

```ts
await router.go("/foo", { skipRender: true });
await router.go("/bar");
```

And this one as well:

```ts
await router.go("/foo", { skipRender: true });
await router.go("/bar", { skipRender: true });
await router.render();
```

## Router configuration

The `createRouter` factory takes a `RouterConf` object as parameter.

### The `Routes`

Example:

```ts
const routes: Routes = {
  "": ({ go }, value) => (isLoggedIn || value) ?? go(["login"]),
  x: resolveX,
  nested: {
    "": resolveNestedIndex,
    y: resolveY,
    level2: {
      z: resolveZ,
    },
    "*": {
      foo: ({ params: [myParam] }) => resolveFoo(myParam),
    },
  },
};
```

### The `RouterConf`

`RouterConf` provides some router-specific configuration:

```ts
interface RouterConf<T> {
  routes?: Routes<T>;
  notFound?: Resolve<T>;
  noClick?: boolean;
  onResolve?: (resolved: Resolved<T>) => void;
}
```

`RouterConf.routes`
The routes configuration.
You may modify this object to change the routes.
Be sure to call `router.init()` after the current route is configured.

`RouterConf.notFound`
A fallback resolve funuction to use, if a route could not be found.
By default it redirects to the root path '/'.

`RouterConf.noClick`
Whether the click handler for anchor elements shall not be installed. This might make sense, if you want to take more control over how anchor clicks are handled.

`RouterConf.onResolve`
A callback that is invoked whenever a route is resolved.
