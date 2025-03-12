import {Routes} from '@angular/router';
import {ConversationComponent} from './routes/conversation/conversation.component';
import {AccountsComponent} from "./routes/accounts/accounts.component";
import {AccountInfoComponent} from "./routes/account-info/account-info.component";

export const routes: Routes = [
  {
    title: 'მომხმარებლები',
    path: '',
    component: AccountsComponent,
    pathMatch: 'full'
  },
  {
    title: 'მომხმარებელი',
    path: 'account-info/:accountId/:accountId2',
    component: AccountInfoComponent
  },
  {
    title: 'მიმოწერა',
    path: 'conversation',
    component: ConversationComponent
  }
];
