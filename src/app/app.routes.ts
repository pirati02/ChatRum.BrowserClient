import { Routes } from '@angular/router';
import { ChatComponent } from './routes/chat/chat.component';
import { AccountsComponent } from './routes/accounts/accounts.component';
import { FeedComponent } from './routes/feed/feed.component';
import { AccountComponent } from './routes/accounts/account-details/account.component';
import { ModifyAccountComponent } from './routes/accounts/modify-account/modify-account.component';
import { ShellComponent } from './shell/shell.component';
import { FriendsComponent } from './routes/friends/friends.component';
import { authGuard } from './core/auth/auth.guard';
import { LoginComponent } from './routes/auth/login/login.component';
import { RegisterComponent } from './routes/auth/register/register.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent, title: 'Sign in' },
  { path: 'register', component: RegisterComponent, title: 'Register' },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      {
        title: 'Accounts',
        path: '',
        component: AccountsComponent,
        pathMatch: 'full',
      },
      {
        title: 'Account Details',
        path: 'account-details/:accountId',
        component: AccountComponent,
      },
      {
        title: 'Feed',
        path: 'feed/:accountId',
        component: FeedComponent,
      },
      {
        title: 'Modify Account',
        path: 'account/:accountId/modify',
        component: ModifyAccountComponent,
      },
      {
        title: 'Messenger',
        path: 'chat',
        component: ChatComponent,
      },
      {
        title: 'Friends',
        path: 'friends',
        component: FriendsComponent,
      },
    ],
  },
];
