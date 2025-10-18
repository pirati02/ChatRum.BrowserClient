import {Component, OnInit} from "@angular/core";
import {Account} from "../../../models/account";
import {LastChatResponse} from "../../../models/last-chat.response";
import {ChatService} from "../../../services/chat.service";
import {Router} from "@angular/router";
import {MessageStatus} from "../../../models/message.status";
import {LastestMessage} from "../../../models/latest-message.response";
import {PeerExtended} from "../account-friends/account-friends.component";

@Component({
  selector: 'app-account',
  templateUrl: './account.component.html',
  styleUrls: ['./account.component.scss']
})
export class AccountComponent implements OnInit {

  account?: Account;
  friends: PeerExtended[] = [];
  chats: LastChatResponse[] = [];

  constructor(
    private chatService: ChatService,
    private router: Router
  ) {
  }

  ngOnInit(): void {
    this.chatService.chatAppendMessage$.subscribe(message => {
      if (message) {
        this.chatService.updateMessageStatus(message?.message!, MessageStatus.Delivered);
        const chat = this.chats.find(item => item?.chatId === message?.message.chatId);
        if (chat) {
          chat.message = <LastestMessage>{
            content: message?.message.content,
            sender: message?.message.sender,
            chatId: message?.message.chatId,
            messageId: message?.message.messageId
          };
        }
      }
    });
  }


  openChat(chat: LastChatResponse) {
    const selectedFriends = chat.participants
      .map(friend => <Account>{
        id: friend.id,
        firstName: friend.firstName,
        lastName: friend.lastName,
        userName: friend.nickName,
        isVerified: true //accepted friend requests are always verified
      });

    this.router.navigate(['chat'], {
      queryParams: {
        chatId: chat.chatId,
        me: JSON.stringify(this.account),
        receivers: JSON.stringify(selectedFriends)
      }
    }).then();
  }

  loadAccount($event: Account) {
    this.account = $event;
    this.chatService.findTop10Conversation(this.account.id)
      .subscribe(chats => {
        this.chats = chats;
      });
    this.chatService.startConnection(this.account.id)
  }
}
