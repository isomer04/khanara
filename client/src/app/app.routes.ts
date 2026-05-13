import { Routes } from '@angular/router';
import { authGuard } from '../core/guards/auth-guard';
import { adminGuard } from '../core/guards/admin-guard';
import { cookGuard } from '../core/guards/cook-guard';
import { noCookProfileGuard } from '../core/guards/no-cook-profile-guard';

// Only the shell components that are always needed on first paint are eagerly loaded.
// Everything else uses loadComponent() so Angular splits them into separate chunks,
// reducing the initial bundle size.

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('../features/home/home').then(m => m.Home),
  },
  {
    path: 'cooks',
    loadComponent: () => import('../features/cooks/cook-list/cook-list').then(m => m.CookList),
  },
  {
    path: 'cooks/:id',
    loadComponent: () => import('../features/cooks/cook-detail/cook-detail').then(m => m.CookDetail),
  },
  {
    path: 'register',
    loadComponent: () => import('../features/account/register/register').then(m => m.Register),
  },
  {
    path: 'server-error',
    loadComponent: () => import('../shared/errors/server-error/server-error').then(m => m.ServerError),
  },

  // ── Authenticated routes ──────────────────────────────────────────────────
  {
    path: '',
    runGuardsAndResolvers: 'always',
    canActivate: [authGuard],
    children: [
      {
        path: 'admin',
        canActivate: [adminGuard],
        loadComponent: () => import('../features/admin/admin').then(m => m.Admin),
      },
      {
        path: 'cook/onboarding',
        canActivate: [noCookProfileGuard],
        loadComponent: () =>
          import('../features/cook-dashboard/onboarding/cook-onboarding').then(m => m.CookOnboarding),
      },
      {
        path: 'cook/dashboard',
        canActivate: [cookGuard],
        loadComponent: () =>
          import('../features/cook-dashboard/dashboard/cook-dashboard').then(m => m.CookDashboard),
      },
      {
        path: 'cook/dishes/new',
        canActivate: [cookGuard],
        loadComponent: () =>
          import('../features/cook-dashboard/dish-form/dish-form').then(m => m.DishForm),
      },
      {
        path: 'cook/dishes/:id/edit',
        canActivate: [cookGuard],
        loadComponent: () =>
          import('../features/cook-dashboard/dish-form/dish-form').then(m => m.DishForm),
      },
      {
        path: 'checkout',
        loadComponent: () => import('../features/orders/checkout/checkout').then(m => m.Checkout),
      },
      {
        path: 'orders',
        loadComponent: () => import('../features/orders/order-list/order-list').then(m => m.OrderList),
      },
      {
        path: 'orders/:id',
        loadComponent: () =>
          import('../features/orders/order-detail/order-detail').then(m => m.OrderDetail),
      },
      {
        path: 'orders/:id/chat',
        loadComponent: () =>
          import('../features/orders/order-chat/order-chat').then(m => m.OrderChat),
      },
      {
        path: 'payment/success',
        loadComponent: () =>
          import('../features/orders/payment-success/payment-success').then(m => m.PaymentSuccess),
      },
      {
        path: 'favorites',
        loadComponent: () => import('../features/favorites/favorites').then(m => m.Favorites),
      },
      {
        path: 'members/:id',
        loadComponent: () =>
          import('../features/account/member-edit/member-edit').then(m => m.MemberEdit),
      },
    ],
  },

  // ── Fallback ──────────────────────────────────────────────────────────────
  {
    path: '**',
    loadComponent: () => import('../shared/errors/not-found/not-found').then(m => m.NotFound),
  },
];
