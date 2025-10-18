import {Routes} from '@angular/router';
import {ChatComponent} from './routes/chat/chat.component';
import {AccountsComponent} from "./routes/accounts/accounts.component";
import {CreateAccountComponent} from "./routes/accounts/create-account/create-account.component";
import {FeedComponent} from "./routes/feed/feed.component";
import {AccountComponent} from "./routes/accounts/account-details/account.component";
import {ModifyAccountComponent} from "./routes/accounts/modify-account/modify-account.component";

export const routes: Routes = [
  {
    title: 'მომხმარებლები',
    path: '',
    component: AccountsComponent,
    pathMatch: 'full'
  },
  {
    title: 'მომხმარებელი',
    path: 'account/:accountId',
    component: AccountComponent
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
    title: 'ახალი-მომხმარებელი',
    path: 'account/:accountId/modify',
    component: ModifyAccountComponent
  },
  {
    title: 'მიმოწერა',
    path: 'chat',
    component: ChatComponent
  }
];
