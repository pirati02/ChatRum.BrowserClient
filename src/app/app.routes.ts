import {Routes} from '@angular/router';
import {ChatComponent} from './routes/chat/chat.component';
import {AccountsComponent} from "./routes/accounts/accounts.component";
import {CreateAccountComponent} from "./routes/create-account/create-account.component";
import {FeedComponent} from "./routes/feed/feed.component";
import {AccountDetailsComponent} from "./routes/accounts/account-details/account-details.component";

export const routes: Routes = [
  {
    title: 'მომხმარებლები',
    path: '',
    component: AccountsComponent,
    pathMatch: 'full'
  },
  {
    title: 'მომხმარებელი',
    path: 'account-details/:accountId',
    component: AccountDetailsComponent
  },
  {
    title: 'მომხმარებელი',
    path: 'feed/:accountId',
    component: FeedComponent
  },
  {
    title: 'ახალი-მომხმარებელი',
    path: 'account/new',
    component: CreateAccountComponent
  },
  {
    title: 'მიმოწერა',
    path: 'chat',
    component: ChatComponent
  }
];
