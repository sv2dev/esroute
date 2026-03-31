# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.12.1] - 2026-04-01

### Fixed
- `href` getter now includes the hash fragment when `NavOpts` is constructed from a path array (previously the hash was silently dropped, breaking `history.pushState` for hash-based navigation)
- Hash is now preserved through redirects in `resolveCurrent()`

### Changed
- Added `sideEffects: false` to both packages' `package.json` — bundlers can now tree-shake unused exports (e.g. drop `restoreHandling` when only `createRouter` is imported)
- Minor bundle size reduction: removed dead code in `scroll-restoration`, replaced `new Array()` with `[]`

## [0.12.0] - 2026-04-01

### Added
- Type-safe routing: `createRouter` now infers a `RoutePaths` type from the routes configuration, and `router.go()` enforces typed paths at compile time
- Typed state: `NavOpts<S>` and `createRouter<T, S>` are now generic over the state type

### Fixed
- `NavOpts.state` is now always `null` instead of `undefined` when no state is provided
- Route resolution now correctly returns not-found when an intermediate path segment is unmatched (previously could match a route deeper in the tree)

## [0.11.1] - 2026-03-31

### Fixed
- Source maps are now included in the published npm package

## [0.11.0] - 2025-10-21

### Added
- `router.render(defer?)` — pass a defer function to batch multiple successive navigations without intermediate renders. The router resolves only the final navigation once the deferred work completes.

## [0.10.0] - 2025-04-17

### Fixed
- Search params passed via `NavMeta` are no longer overridden by the search string embedded in an href
- State defaults to `null` (previously could be `undefined`)

## [0.9.0] - 2024-04-16

### Added
- `router.go()` now accepts a function `(prev: NavOpts) => NavMeta` to patch the current navigation state in place (uses `replaceState` by default)

### Fixed
- Corrected TypeScript overload types for `router.go()`

## [0.8.3] - 2024-04-16

### Added
- `router.current` exposes the current `NavOpts` after the last completed resolution

## [0.8.1] - 2024-01-17

### Fixed
- Router no longer becomes permanently unresponsive when a route resolution promise rejects

## [0.8.0] - 2023-04-12

### Added
- Scroll restoration via `restoreHandling()` — saves and restores scroll position on navigation, supports hash-based anchor scrolling and a configurable container/offset

### Changed
- `NavOpts` now exposes `hash` and `pop` fields

## [0.6.0] - 2022-10-18

### Added
- Guards: add a `"?"` key to any route object to register a guard function. If the guard returns a `NavOpts`, the navigation is redirected.
- `routes` is now optional in `createRouter()` (defaults to `{}`)

## [0.5.4] - 2022-09-21

### Added
- `router.routes` is now exposed on the `Router` interface, allowing routes to be modified after creation

### Fixed
- Fixed virtual route (`""` key) resolution ordering

## [0.5.0] - 2022-09-18

### Changed
- **Breaking**: `createRouter` is now a factory function instead of a class — use `createRouter({ routes, ... })` instead of `new Router(...)`)
- Reduced bundle size by removing unused abstractions

### Removed
- `NavOpts.equals()` method

## [0.4.2] - 2022-07-01

### Fixed
- Guard was not being called on index routes (`""` key)
- Fixed ESM import paths in `@esroute/lit`

## [0.4.1] - 2022-04-18

### Added
- `@esroute/lit` package: `renderRoutes` Lit directive for declarative route rendering in Lit components

## [0.3.0] - 2022-04-13

### Changed
- Converted the resolver to a plain function for better tree-shaking
- Route spec compilation is now opt-in (not compiled by default)

## [0.2.0] - 2022-04-08

### Added
- Deep link support in the route spec (nested path configuration)

## [0.1.1] - 2022-01-01

### Fixed
- Minor fixes and dependency updates

## [0.1.0] - 2022-01-01

### Added
- Initial release of `esroute`
- Framework-agnostic client-side router with `createRouter()`
- Path-based route matching with wildcard (`*`) support
- Virtual routes (`""` key) for middleware/layout patterns
- Anchor click interception
- Promise-based serialized navigation
