import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { CreateAccountComponent } from './login/create-account/create-account.component';
import { SelectAvatarComponent } from './login/create-account/select-avatar/select-avatar.component';
import { ResetPasswordComponent } from './login/reset-password/reset-password/reset-password.component';
import { SendEmailComponent } from './login/reset-password/send-email/send-email.component';
import { SignInComponent } from './login/sign-in/sign-in.component';
import { BoardComponent } from './board/board.component';
import { PrivacyPolicyComponent } from './shared/legal-pages/privacy-policy/privacy-policy.component';
import { LegalNoticeComponent } from './shared/legal-pages/legal-notice/legal-notice.component';


export const routes: Routes = [
    {
        path: '', component: LoginComponent,
        children: [
            { path: '', component: SignInComponent },
            { path: 'create-account', component: CreateAccountComponent },
            { path: 'select-avatar', component: SelectAvatarComponent },
            { path: 'reset-password', component: ResetPasswordComponent },
            { path: 'send-mail', component: SendEmailComponent },
            { path: 'sign-in', component: SignInComponent },
            { path: 'privacy-policy', component: PrivacyPolicyComponent },
            { path: 'legal-notice', component: LegalNoticeComponent }
        ]
    },
    { path: 'board', component: BoardComponent },
];
