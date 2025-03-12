import {Routes} from '@angular/router';
import {ConversationComponent} from './routes/conversation/conversation.component';
import {AccountsComponent} from "./routes/accounts/accounts.component";

export const routes: Routes = [
  {
    title: 'მომხმარებლები',
    path: '',
    component: AccountsComponent,
    pathMatch: 'full'
  },
  {
    title: 'მომხმარებლები',
    path: 'conversation',
    component: ConversationComponent
  }
];
