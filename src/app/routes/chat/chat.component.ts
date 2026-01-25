import {AfterViewInit, Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild} from "@angular/core";
import {ChatService} from "../../services/chat.service";
import {catchError, delay, mergeMap, Observable, of, Subscription, tap, from, switchMap} from "rxjs";
import {MessageRequest} from "../../models/message.request";
import {MessageResponse} from "../../models/message.response";
import {MessageStatus} from "../../models/message.status";
import {ActivatedRoute} from "@angular/router";
import {ApiError} from "../../models/api.error";
import {ErrorType} from "../../models/error.types";
import {Participant} from "../../models/participant";
import {Account} from "../../models/account";
import {MatDialog} from "@angular/material/dialog";
import {ChatDetailsComponent, ChatDetailsData} from "../chat-details/chat-details.component";
import {ChatResponse} from "../../models/chat.response";
import {EncryptedContent, ImageContent, PlainTextContent} from "../../models/message.content";
import {HelperService} from "../../services/helper.service";
import {SendFileEvent, SendMessageEvent} from "./message-input/message-input.component";
import {CryptoService} from "../../services/crypto.service";
import {AccountsService} from "../../services/accounts.service";
import {KeyPair, RecipientPublicKey} from "../../models/encrypted-message";

export type uiStatus = 'sent' | 'seen' | 'delivered' | 'failed' | ''

export interface UiMessage extends MessageResponse {
  statusString: string,
}

interface Chat {
  chatId: string | null;
  messages: UiMessage[],
  participants?: Participant[],
  creator: Participant | null,
  createdDate: string | null
}

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss']
})
export class ChatComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('scrollElement') scrollContainer?: ElementRef<HTMLDivElement>;
  chat: Chat = <Chat>{
    chatId: null,
    messages: [],
    participants: [],
    creator: null,
    createdDate: null
  };

  me?: Participant;
  overrideExisting: boolean = false;
  private subscriptions: Subscription[] = [];
  private keyPair: KeyPair | null = null;
  encryptionEnabled: boolean = false;
  encryptionError: string | null = null;

  constructor(
    private activatedRoute: ActivatedRoute,
    private chatService: ChatService,
    private ngZone: NgZone,
    private dialog: MatDialog,
    private helperService: HelperService,
    private cryptoService: CryptoService,
    private accountsService: AccountsService
  ) {
  }

  ngOnInit() {
    this.gatherChatInfo()
      .pipe(
        // Initialize encryption before starting connection
        switchMap(() => from(this.initializeEncryption())),
        tap(() => {
          this.chatService.startConnection(this.me?.id!)
        }),
        delay(1000),
        mergeMap(({chatId}) => {
          if (this.overrideExisting) {
            return of();
          }

          if (chatId) {
            return this.chatService.getChat(chatId)
              .pipe(tap(res => this.initializeChat(res)))
          }
          return this.chatService.findChat(this.chat?.participants!)
            .pipe(
              tap(res => this.initializeChat(res)),
              catchError(err => {
                let apiErrors: ApiError[] = [];

                if (err.error) {
                  apiErrors = Array.isArray(err.error) ? err.error : [err.error];
                }

                const convNotFound = apiErrors.find(e => e.type === ErrorType.NotFound);
                if (convNotFound) {
                  this.startChatInternal().subscribe(() => this.scrollToBottom());
                }

                return of(null);
              })
            );
        })
      ).subscribe();

    this.startListeners();
  }

  ngAfterViewInit(): void {
    this.scrollToBottom();
  }

  ngOnDestroy() {
    this.chatService.stopConnection();
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  onSendMessage(event: SendMessageEvent) {
    const content = event.content?.trim();
    if (!content) return;

    // If encryption is enabled and we have keys, encrypt the message
    if (this.encryptionEnabled && this.keyPair && this.hasAllParticipantKeys()) {
      this.sendEncryptedMessage(content);
    } else {
      // Fallback to unencrypted message
      const messageContent: PlainTextContent = this.helperService.isLink(content)
        ? {type: 'link', $type: 'link', content} as any as PlainTextContent
        : {type: 'plain', $type: 'plain', content};

      this.dispatchMessage({
        sender: this.me!,
        content: messageContent,
        replyOf: null
      });
    }
  }

  private async sendEncryptedMessage(content: string) {
    try {
      const recipients = this.getRecipientsWithKeys();
      const encryptionResult = await this.cryptoService.encryptMessage(
        content,
        recipients,
        this.keyPair!
      );

      const encryptedContent: EncryptedContent = {
        type: 'encrypted',
        $type: 'encrypted',
        content: encryptionResult.encryptedContent,
        iv: encryptionResult.iv,
        encryptedKeys: encryptionResult.encryptedKeys
      };

      this.dispatchMessage({
        sender: this.me!,
        content: encryptedContent,
        replyOf: null
      });
    } catch (error) {
      console.error('Failed to encrypt message:', error);
      // Fallback to plain text if encryption fails
      const messageContent: PlainTextContent = this.helperService.isLink(content)
        ? {type: 'link', $type: 'link', content} as any as PlainTextContent
        : {type: 'plain', $type: 'plain', content};

      this.dispatchMessage({
        sender: this.me!,
        content: messageContent,
        replyOf: null
      });
    }
  }

  private hasAllParticipantKeys(): boolean {
    return this.chat.participants?.every(p => p.id === this.me?.id || !!p.publicKey) ?? false;
  }

  private getRecipientsWithKeys(): RecipientPublicKey[] {
    return this.chat.participants
      ?.filter(p => p.publicKey)
      .map(p => ({
        recipientId: p.id,
        publicKey: p.publicKey!
      })) ?? [];
  }

  onSendFile(event: SendFileEvent) {
    if (!event.file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      this.dispatchMessage({
        sender: this.me!,
        content: <ImageContent>{type: 'image', content: base64},
        replyOf: null
      });
    };
    reader.readAsDataURL(event.file);
  }

  private dispatchMessage(message: MessageRequest) {
    const send$ = this.chat.chatId
      ? this.chatService.sendMessage(this.chat.chatId, message)
      : this.startChatInternal().pipe(
          mergeMap(() => this.chatService.sendMessage(this.chat.chatId!, message))
        );

    send$.subscribe(() => this.scrollToBottom());
  }

  openChatDetails() {
    this.dialog.open(ChatDetailsComponent, {
      width: '400px',
      data: <ChatDetailsData>{
        participants: this.chat.participants,
        creator: this.chat.creator,
        createdDate: this.chat.createdDate
      }
    });
  }

  retryMessage(message: UiMessage) {
    if (!this.chat.chatId) return;

    message.status = MessageStatus.Sent;
    message.statusString = this.statusString(MessageStatus.Sent);

    this.chatService.sendMessage(this.chat.chatId, {
      sender: message.sender,
      content: message.content,
      replyOf: message.replyOf
    }).subscribe();
  }

  getReceiver(id: string): Participant | undefined {
    return this.chat?.participants?.find(p => p.id === id);
  }

  private async initializeChat(res: ChatResponse) {
    // First set up the chat with participants (needed for decryption)
    this.chat = {
      ...res,
      messages: [],
      participants: res.participants,
      creator: res.creator,
      createdDate: res.createdDate
    };

    // Decrypt messages if needed
    const decryptedMessages: UiMessage[] = [];
    for (const m of res.messages) {
      const uiMessage = this.toUiMessage(m);
      const decrypted = await this.decryptMessageIfNeeded(uiMessage);
      decryptedMessages.push(decrypted);
    }
    this.chat.messages = decryptedMessages;

    this.markUnreadMessagesAsSeen();
  }

  private toUiMessage(message: MessageResponse): UiMessage {
    return {
      ...message,
      statusString: this.statusString(message.status)
    };
  }

  private markUnreadMessagesAsSeen() {
    const otherParticipantIds = this.chat.participants
      ?.filter(p => p.id !== this.me?.id)
      .map(p => p.id) ?? [];

    const unreadMessages = this.chat.messages.filter(m =>
      [MessageStatus.Sent, MessageStatus.Delivered].includes(m.status) &&
      otherParticipantIds.includes(m.sender.id)
    );

    if (unreadMessages.length === 0) return;

    this.chatService.markAsRead(this.chat.chatId!, unreadMessages.map(m => m.messageId))
      .subscribe(success => {
        if (success) {
          this.chat.messages.forEach(m => {
            m.status = MessageStatus.Seen;
            m.statusString = this.statusString(MessageStatus.Seen);
          });
        }
      });
  }

  private startChatInternal() {
    const chatName = this.chat.participants?.length! > 2
      ? this.chat?.participants!.map(p => p.nickName).join(', ')
      : this.chat?.participants!.find(p => p.id !== this.me?.id)?.nickName;

    return this.chatService.startChat(
      this.chat?.participants!!,
      this.me!,
      chatName!,
      this.overrideExisting
    );
  }

  private gatherChatInfo(): Observable<any> {
    return this.activatedRoute.queryParams.pipe(
      tap(params => {
        const receivers = JSON.parse(params['receivers']) as Account[];
        const me = JSON.parse(params['me']) as Account;

        this.me = this.toParticipant(me);
        this.overrideExisting = params["overrideExisting"] === "true";
        this.chat = {
          ...this.chat,
          chatId: params["chatId"],
          participants: [
            ...this.chat.participants!,
            ...receivers.map(r => this.toParticipant(r)),
            this.me
          ]
        };
      })
    );
  }

  private toParticipant(account: Account): Participant {
    return {
      id: account.id,
      firstName: account.firstName,
      lastName: account.lastName,
      nickName: account.userName,
      isAdmin: false
    };
  }

  private startListeners() {
    this.subscriptions.push(
      this.chatService.chatStarted$.subscribe(res => this.chat.chatId = res!),
      this.chatService.updateMessageState$.subscribe(result => this.handleMessageStateUpdate(result)),
      this.chatService.chatAppendMessage$.subscribe(result => this.handleNewMessage(result)),
      this.chatService.messageFailed$.subscribe(result => this.handleMessageFailed(result))
    );
  }

  /**
   * Initialize E2E encryption - generate or retrieve key pair
   */
  private async initializeEncryption(): Promise<{ chatId?: string }> {
    try {
      // Check if storage is available
      const storageAvailable = await this.cryptoService.isStorageAvailable();
      if (!storageAvailable) {
        this.encryptionError = 'Secure storage unavailable (private browsing mode?)';
        console.warn('IndexedDB not available, encryption disabled');
        return { chatId: this.chat.chatId ?? undefined };
      }

      // Try to get existing key pair
      this.keyPair = await this.cryptoService.getKeyPair(this.me!.id);

      if (!this.keyPair) {
        // Generate new key pair
        this.keyPair = await this.cryptoService.generateKeyPair();
        await this.cryptoService.storeKeyPair(this.me!.id, this.keyPair);

        // Register public key with server
        const publicKeyBase64 = await this.cryptoService.exportPublicKey(this.keyPair.publicKey);
        await this.accountsService.registerPublicKey(this.me!.id, publicKeyBase64).toPromise();

        console.log('Generated and registered new encryption key pair');
      } else {
        console.log('Loaded existing encryption key pair from storage');
      }

      // Set own public key on me participant
      if (this.me && this.keyPair) {
        this.me.publicKey = await this.cryptoService.exportPublicKey(this.keyPair.publicKey);
      }

      this.encryptionEnabled = true;
      return { chatId: this.chat.chatId ?? undefined };
    } catch (error) {
      console.error('Failed to initialize encryption:', error);
      this.encryptionError = 'Failed to initialize encryption';
      return { chatId: this.chat.chatId ?? undefined };
    }
  }

  private handleMessageStateUpdate(result: { messageId: string; status: MessageStatus } | null) {
    if (!result?.messageId) return;

    const message = this.chat.messages.find(item => item.messageId === result.messageId);
    if (message) {
      message.status = result.status;
      message.statusString = this.statusString(result.status);
    }
  }

  private async handleNewMessage(result: { message: UiMessage; update: boolean } | null) {
    if (!result?.message) return;
    if (this.chat.messages.some(m => m.messageId === result.message.messageId)) return;

    // Decrypt message if it's encrypted
    const decryptedMessage = await this.decryptMessageIfNeeded(result.message);
    decryptedMessage.statusString = this.statusString(decryptedMessage.status);
    this.chat.messages.push(decryptedMessage);

    if (result.update) {
      this.chatService.updateMessageStatus(decryptedMessage, MessageStatus.Seen);
    }
    this.scrollToBottom();
  }

  private async decryptMessageIfNeeded(message: UiMessage): Promise<UiMessage> {
    if (message.content?.type !== 'encrypted' && message.content?.$type !== 'encrypted') {
      return message;
    }

    if (!this.keyPair) {
      // Return message with placeholder if we don't have keys
      return {
        ...message,
        content: {
          type: 'plain',
          $type: 'plain',
          content: '🔒 Encrypted message (unable to decrypt)'
        }
      };
    }

    try {
      const encryptedContent = message.content as EncryptedContent;
      const senderPublicKey = this.chat.participants?.find(p => p.id === message.sender.id)?.publicKey
        || message.sender.publicKey;

      if (!senderPublicKey) {
        return {
          ...message,
          content: {
            type: 'plain',
            $type: 'plain',
            content: '🔒 Encrypted message (sender key unavailable)'
          }
        };
      }

      const myEncryptedKey = encryptedContent.encryptedKeys[this.me!.id];
      if (!myEncryptedKey) {
        return {
          ...message,
          content: {
            type: 'plain',
            $type: 'plain',
            content: '🔒 Encrypted message (not encrypted for you)'
          }
        };
      }

      const decryptedText = await this.cryptoService.decryptMessage(
        encryptedContent.content,
        encryptedContent.iv,
        myEncryptedKey,
        senderPublicKey,
        this.keyPair
      );

      return {
        ...message,
        content: {
          type: 'plain',
          $type: 'plain',
          content: decryptedText
        }
      };
    } catch (error) {
      console.error('Failed to decrypt message:', error);
      return {
        ...message,
        content: {
          type: 'plain',
          $type: 'plain',
          content: '🔒 Encrypted message (decryption failed)'
        }
      };
    }
  }

  private handleMessageFailed(result: UiMessage | null) {
    if (!result) return;

    const message = this.chat.messages.find(item => item.messageId === result.messageId);
    if (message) {
      message.status = MessageStatus.Failed;
      message.statusString = this.statusString(MessageStatus.Failed);
    } else {
      result.status = MessageStatus.Failed;
      result.statusString = this.statusString(MessageStatus.Failed);
      this.chat.messages.push(result);
      this.scrollToBottom();
    }
  }

  private scrollToBottom(): void {
    this.ngZone.run(() => {
      const scrollContainer = this.scrollContainer!.nativeElement;
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    });
  }

  private statusString(status: 'Seen' | 'Sent' | 'Delivered' | 'Failed' | MessageStatus): uiStatus {
    switch (status) {
      case 'Sent':
      case MessageStatus.Sent:
        return "sent";
      case 'Delivered':
      case MessageStatus.Delivered:
        return "delivered";
      case 'Seen':
      case MessageStatus.Seen:
        return "seen";
      case 'Failed':
      case MessageStatus.Failed:
        return "failed";
      default:
        return '';
    }
  }
}
