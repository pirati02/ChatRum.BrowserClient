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
import {AccountInfoComponent} from "./routes/accounts/account-info/account-info.component";
import {CreateAccountComponent} from "./routes/accounts/create-account/create-account.component";
import {MatInput} from "@angular/material/input";
import {ChatDetailsComponent} from "./routes/chat-details/chat-details.component";
import {MatDialogActions, MatDialogContent, MatDialogTitle} from "@angular/material/dialog";
import {MatTooltipModule} from "@angular/material/tooltip";
import {FeedComponent} from "./routes/feed/feed.component";
import {AccountComponent} from "./routes/accounts/account-details/account.component";
import {AccountFriendsComponent} from "./routes/accounts/account-friends/account-friends.component";
import {ModifyAccountComponent} from "./routes/accounts/modify-account/modify-account.component";
import {MessageContentComponent} from "./routes/chat/message-content/message-content.component";
import {MessageBubbleComponent} from "./routes/chat/message-bubble/message-bubble.component";
import {MessageInputComponent} from "./routes/chat/message-input/message-input.component";


@NgModule({
  providers: [
    provideHttpClient(withFetch(), withJsonpSupport())
  ],
  declarations: [
    ChatComponent,
    AccountsComponent,
    AccountInfoComponent,
    AccountComponent,
    AccountFriendsComponent,
    CreateAccountComponent,
    ModifyAccountComponent,
    ChatDetailsComponent,
    FeedComponent,
    MessageContentComponent,
    MessageBubbleComponent,
    MessageInputComponent
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
    MatDialogTitle,
    MatTooltipModule
  ]
})
export class AppModule {

}
