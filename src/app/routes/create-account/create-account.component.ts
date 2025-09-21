import {Component, OnInit} from "@angular/core";
import {AccountsService} from "../../services/accounts.service";
import {Router} from "@angular/router";
import {FormBuilder, FormGroup, Validators} from "@angular/forms";

@Component({
  selector: 'app-create-account',
  templateUrl: './create-account.component.html',
  styleUrls: ['./create-account.component.scss']
})
export class CreateAccountComponent implements OnInit {

  accountForm!: FormGroup;
  isSubmitting = false;

  constructor(
    private fb: FormBuilder,
    private accountsService: AccountsService,
    private router: Router
  ) {
  }

  ngOnInit(): void {
    this.accountForm = this.fb.group({
      userName: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      password: ['', [Validators.required, Validators.minLength(6)]],
      phoneNumber: ['', Validators.required],
      countryCode: ['', Validators.required]
    });
  }

  onSubmit(): void {
    if (this.accountForm.invalid) {
      this.accountForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;

    const newAccount = this.accountForm.value;

    this.accountsService.createAccount(newAccount)
      .pipe()
      .subscribe({
        next: () => {
          this.isSubmitting = false;
          // Navigate to accounts list or details page
          this.router.navigate(['/accounts']);
        },
        error: (err) => {
          console.error('Failed to create account', err);
          this.isSubmitting = false;
        }
      });
  }

  onCancel(): void {
    this.router.navigate(['/accounts']);
  }
}
