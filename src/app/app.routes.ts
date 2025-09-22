import {Routes} from '@angular/router';
import {ChatComponent} from './routes/chat/chat.component';
import {AccountsComponent} from "./routes/accounts/accounts.component";
import {AccountInfoComponent} from "./routes/account-info/account-info.component";
import {CreateAccountComponent} from "./routes/create-account/create-account.component";

export const routes: Routes = [
  {
    title: 'მომხმარებლები',
    path: '',
    component: AccountsComponent,
    pathMatch: 'full'
  },
  {
    title: 'მომხმარებელი',
    path: 'account-info/:accountId',
    component: AccountInfoComponent
  },
  {
    title: 'ახალი-მომხმარებელი',
    path: 'account/new',
    component: CreateAccountComponent
  },
  {
    title: 'მიმოწერა',
    path: 'conversation',
    component: ChatComponent
  }
];
