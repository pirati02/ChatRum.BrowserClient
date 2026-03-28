import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit {
  form!: FormGroup;
  isSubmitting = false;
  errorMessage: string | null = null;
  registeredBanner = false;

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(1)]],
      rememberMe: [false],
    });

    this.route.queryParamMap.subscribe((params) => {
      this.registeredBanner = params.get('registered') === '1';
      const email = params.get('email');
      if (email) {
        this.form.patchValue({ email });
      }
    });
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.errorMessage = null;
    this.isSubmitting = true;
    const { email, password, rememberMe } = this.form.getRawValue() as {
      email: string;
      password: string;
      rememberMe: boolean;
    };
    try {
      await this.auth.login(email, password, rememberMe);
      const returnUrl =
        this.route.snapshot.queryParamMap.get('returnUrl') || '/';
      await this.router.navigateByUrl(returnUrl);
    } catch (err: unknown) {
      if (err instanceof HttpErrorResponse) {
        const e = err.error;
        if (e && typeof e === 'object' && 'message' in e) {
          this.errorMessage = String((e as { message: string }).message);
        } else if (typeof e === 'string') {
          this.errorMessage = e;
        } else {
          this.errorMessage =
            'Sign in failed. Check your email and password.';
        }
      } else {
        this.errorMessage =
          'Sign in failed. Check your email and password.';
      }
    } finally {
      this.isSubmitting = false;
    }
  }
}
