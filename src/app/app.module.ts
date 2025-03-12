import {CommonModule} from "@angular/common";
import {provideHttpClient, withFetch, withJsonpSupport} from "@angular/common/http";
import {NgModule} from "@angular/core";
import {ConversationComponent} from "./routes/conversation/conversation.component";
import {RouterLink, RouterOutlet} from "@angular/router";
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatDividerModule} from '@angular/material/divider';
import {MatListModule} from '@angular/material/list';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {ReactiveFormsModule} from "@angular/forms";
import {AccountsComponent} from "./routes/accounts/accounts.component";
import {MatOption, MatSelect} from "@angular/material/select";
import {AccountInfoComponent} from "./routes/account-info/account-info.component";


@NgModule({
  providers: [
    provideHttpClient(withFetch(), withJsonpSupport())
  ],
  declarations: [
    ConversationComponent,
    AccountsComponent,
    AccountInfoComponent
  ],
  imports: [
    CommonModule,
    RouterOutlet,
    MatIconModule,
    MatButtonModule,
    MatDividerModule,
    MatListModule,
    MatProgressSpinnerModule,
    RouterLink,
    ReactiveFormsModule,
    MatSelect,
    MatOption
  ]
})
export class AppModule {

}
