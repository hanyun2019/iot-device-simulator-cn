import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { UserLoginService } from '../../../service/user-login.service';
import { CognitoCallback, LoggedInCallback } from '../../../service/cognito.service';
import { LoggerService } from '../../../service/logger.service';
import { HttpClient, HttpParams } from '@angular/common/http';
//import { AsyncLocalStorage } from 'angular-async-local-storage';
import * as AWS from 'aws-sdk';



declare var jquery: any;
declare var $: any;


@Component({
    selector: 'app-ratchet',
    templateUrl: './login.html'
})

export class LoginComponent implements CognitoCallback, OnInit { // LoggedInCallback
    email: string;
    password: string;
    errorMessage: string;
    app_id: string;
    app_secret: string;
    app_url: string;
    redirect_url: string;
    authing_oidc_login_url: string;
    authing_oidc_token_url: string;
    authing_oidc_logout_url: string;
    

    constructor(
        public router: Router,
        public userService: UserLoginService,
        private logger: LoggerService,
        private http: HttpClient
        ) {

            //dev env:
        this.app_id = "5e7f45f4215e79341fbe6335" ;
        this.app_secret = "dbca93d5b0caa0aaa7d3e00d48833d38";
        this.app_url = "iotds-cn" ;

        this.redirect_url = "http://127.0.0.1:4200/home/login";
        this.authing_oidc_login_url = `https://${this.app_url}.authing.cn/oauth/oidc/auth?client_id=${this.app_id}&redirect_uri=${this.redirect_url}&scope=openid profile offline_access&response_type=code&prompt=consent&state=235345`;
        this.authing_oidc_token_url = `https://${this.app_url}.authing.cn/oauth/oidc/token`;
        this.authing_oidc_logout_url = `https://${this.app_url}.authing.cn/login/profile/logout?app_id=${this.app_id}&redirect_uri=${this.redirect_url}`;
    }

    ngOnInit() {
        this.errorMessage = null;
        this.logger.info('Checking if the user is already authenticated. If so, then redirect to the secure site');

        $('.owl-carousel').owlCarousel({
            slideSpeed: 300,
            paginationSpeed: 400,
            singleItem: !0,
            autoPlay: !0
        });

        //Check redirect:
        console.log('Check authing redirect')
        const queryString = window.location.search;
        const urlParams = new URLSearchParams(queryString);
        const authorization_code = urlParams.get("code");
        if (authorization_code) {
            console.log('Get authorization code: ' + authorization_code);
            this.exchangeToken(authorization_code);
            console.log('Save logout url')
            localStorage.setItem('logout_url', this.authing_oidc_logout_url)
        }
        else {
            console.log('no code!');
        }
    }

    onLogin() {
        // if (this.email == null || this.password == null) {
        //     this.errorMessage = 'All fields are required';
        //     return;
        // }
        // this.errorMessage = null;
        // this.userService.authenticate(this.email, this.password, this);

        //redirect to authing to get token
        location.href = this.authing_oidc_login_url;

    }

    //will not use cognito user pool
    cognitoCallback(message: string, result: any) {
        if (message != null) {
            // error
            this.errorMessage = message;
            this.logger.info('result: ' + this.errorMessage);
            if (this.errorMessage === 'User is not confirmed.') {
                this.logger.error('redirecting');
                this.router.navigate(['/home/confirmRegistration', this.email]);
            } else if (this.errorMessage === 'User needs to set password.') {
                this.logger.error('redirecting to set new password');
                this.router.navigate(['/home/newPassword']);
            }
        } else {
            // success
            this.router.navigate(['/securehome']);
        }
    }

    //Get id_token and other user information
    authingCallback(id_token: string) {
        console.log("authing Callback: " + id_token);
        localStorage.setItem('id_token', id_token)

        //Get AWS credentail
        AWS.config.region = 'cn-north-1'; // Region
        AWS.config.credentials = new AWS.CognitoIdentityCredentials({
            IdentityPoolId: "cn-north-1:5c5ebc51-84d9-4782-b9c7-58b09581147a",
            Logins: {
                'iotds-cn.authing.cn/oauth/oidc': id_token
            }
        });
    
        console.log("Logged in ")
        console.log(localStorage.getItem('id_token'))
        //navigate to securehome
        this.router.navigate(['/securehome']);
    }

    //Authing: Got authorization code and exchange for id_token
    exchangeToken(authorization_code: string) {
        console.log('Start exchange token: ' + authorization_code);
        const headers = {
            "Content-Type" : "application/x-www-form-urlencoded"
        }
        const body = JSON.stringify({
            "client_id" : this.app_id,
            "client_secret" : this.app_secret,
            "grant_type" : "authorization_code",
            "redirect_uri" : this.redirect_url,
            "code" : authorization_code 
        })

        const params = new HttpParams()
            .set('client_id', this.app_id)
            .set('client_secret', this.app_secret)
            .set('grant_type', "authorization_code")
            .set('redirect_uri', this.redirect_url)
            .set('code', authorization_code)

        console.log(body)

        this.http.post(this.authing_oidc_token_url, params, {headers}).subscribe({
            next: data => this.authingCallback(data['id_token']),
            error: error => console.error('There was an error!', error)
        })
        
    }

    // isLoggedIn(message: string, isLoggedIn: boolean, profile: ProfileInfo) {
    //     if (isLoggedIn) {
    //         this.router.navigate(['/securehome']);
    //     }
    // }
}

