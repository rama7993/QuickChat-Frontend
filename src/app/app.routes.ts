import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: '',
    loadComponent: () =>
      import('./layouts/auth-layout/auth-layout.component').then(
        (m) => m.AuthLayoutComponent
      ),
    children: [
      {
        path: 'login',
        loadComponent: () =>
          import('./pages/auth/login/login.component').then(
            (m) => m.LoginComponent
          ),
      },
      {
        path: 'signup',
        loadComponent: () =>
          import('./pages/auth/signup/signup.component').then(
            (m) => m.SignupComponent
          ),
      },
      {
        path: 'forgot-password',
        loadComponent: () =>
          import('./pages/auth/forgot-password/forgot-password.component').then(
            (m) => m.ForgotPasswordComponent
          ),
      },
      {
        path: 'reset-password',
        loadComponent: () =>
          import('./pages/auth/reset-password/reset-password.component').then(
            (m) => m.ResetPasswordComponent
          ),
      },
      {
        path: 'login-success',
        loadComponent: () =>
          import('./pages/auth/login-success/login-success.component').then(
            (m) => m.LoginSuccessComponent
          ),
      },
    ],
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./layouts/main-layout/main-layout.component').then(
        (m) => m.MainLayoutComponent
      ),
    children: [
      {
        path: 'profile',
        loadComponent: () =>
          import('./pages/features/profile/profile.component').then(
            (m) => m.ProfileComponent
          ),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./pages/features/settings/settings.component').then(
            (m) => m.SettingsComponent
          ),
      },
      {
        path: 'create-group',
        loadComponent: () =>
          import(
            './pages/features/groups/create-group/create-group.component'
          ).then((m) => m.CreateGroupComponent),
      },
      {
        path: 'groups',
        loadComponent: () =>
          import(
            './pages/features/groups/group-list/group-list.component'
          ).then((m) => m.GroupListComponent),
      },
      {
        path: 'chat',
        loadComponent: () =>
          import('./pages/features/chat/chat.component').then(
            (m) => m.ChatComponent
          ),
      },
      {
        path: 'notifications',
        loadComponent: () =>
          import(
            './shared/components/notifications/notifications.component'
          ).then((m) => m.NotificationsComponent),
      },
    ],
  },
  {
    path: '**',
    loadComponent: () =>
      import('./pages/features/not-found/not-found.component').then(
        (m) => m.NotFoundComponent
      ),
  },
];
