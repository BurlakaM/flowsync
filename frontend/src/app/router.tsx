import { createBrowserRouter, type RouteObject } from 'react-router';
import { RouteError } from '@/components/errors/route-error';
import { FullPageSpinner } from '@/components/spinner';
import { ProtectedRoute } from '@/features/auth';

// Pages are loaded on demand: the first screen downloads only what it needs.
export const routes: RouteObject[] = [
  {
    // Shown while the first lazy route is loading and when any route fails.
    HydrateFallback: FullPageSpinner,
    ErrorBoundary: RouteError,
    children: [
      {
        path: '/login',
        lazy: async () => ({
          Component: (await import('./routes/login')).default,
        }),
      },
      {
        // Everything inside requires a signed-in user.
        Component: ProtectedRoute,
        children: [
          {
            lazy: async () => ({
              Component: (await import('./routes/app-shell')).default,
            }),
            children: [
              {
                index: true,
                lazy: async () => ({
                  Component: (await import('./routes/dashboard')).default,
                }),
              },
            ],
          },
        ],
      },
      {
        path: '*',
        lazy: async () => ({
          Component: (await import('./routes/not-found')).default,
        }),
      },
    ],
  },
];

export const createAppRouter = () => createBrowserRouter(routes);
