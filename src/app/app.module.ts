import {CommonModule} from "@angular/common";
import {provideHttpClient, withFetch, withJsonpSupport} from "@angular/common/http";
import {NgModule} from "@angular/core";
import {ChatComponent} from "./routes/chat/chat.component";
import {RouterLink, RouterOutlet} from "@angular/router";
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatDividerModule} from '@angular/material/divider';
import {MatListModule} from '@angular/material/list';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {AccountsComponent} from "./routes/accounts/accounts.component";
import {MatError, MatFormField, MatLabel, MatOption, MatSelect} from "@angular/material/select";
import {AccountInfoComponent} from "./routes/account-info/account-info.component";
import {CreateAccountComponent} from "./routes/create-account/create-account.component";
import {MatInput} from "@angular/material/input";
import {ChatDetailsComponent} from "./routes/chat-details/chat-details.component";
import {MatDialogActions, MatDialogContent, MatDialogTitle} from "@angular/material/dialog";


@NgModule({
  providers: [
    provideHttpClient(withFetch(), withJsonpSupport())
  ],
  declarations: [
    ChatComponent,
    AccountsComponent,
    AccountInfoComponent,
    CreateAccountComponent,
    ChatDetailsComponent
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
    MatOption,
    MatFormField,
    MatLabel,
    MatError,
    MatInput,
    FormsModule,
    MatDialogActions,
    MatDialogContent,
    MatDialogTitle
  ]
})
export class AppModule {

}
