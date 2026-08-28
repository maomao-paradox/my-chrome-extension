/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/pages/options/views/router.ts
 * @date 2026-02-05T02:38:01.695Z
 */

export interface OptionsRoute {
  path: string;
  public: boolean;
}

export const optionsRoutes: OptionsRoute[] = [
  { path: "/home", public: true },
  { path: "/login", public: true },
  { path: "/user", public: false },
  { path: "/domain-config", public: false },
  { path: "/extension-settings", public: false },
  { path: "/error-monitor", public: false },
];

export const isOptionsRoutePublic = (path: string): boolean =>
  optionsRoutes.some((route) => route.path === path && route.public);

export default optionsRoutes;
