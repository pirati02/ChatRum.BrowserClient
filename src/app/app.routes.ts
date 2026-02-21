import { Routes } from '@angular/router';
import { ChatComponent } from './routes/chat/chat.component';
import { AccountsComponent } from './routes/accounts/accounts.component';
import { CreateAccountComponent } from './routes/accounts/create-account/create-account.component';
import { FeedComponent } from './routes/feed/feed.component';
import { AccountComponent } from './routes/accounts/account-details/account.component';
import { ModifyAccountComponent } from './routes/accounts/modify-account/modify-account.component';

export const routes: Routes = [
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
    title: 'Account Details',
    path: 'feed/:accountId',
    component: FeedComponent,
  },
  {
    title: 'New Account',
    path: 'account/new',
    component: CreateAccountComponent,
  },
  {
    title: 'New Account',
    path: 'account/:accountId/modify',
    component: ModifyAccountComponent,
  },
  {
    title: 'Messenger',
    path: 'chat',
    component: ChatComponent,
  },
];
