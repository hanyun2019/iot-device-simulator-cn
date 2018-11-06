import { Component, Input, OnInit, OnDestroy, ViewChild, NgZone } from '@angular/core';
import { FormGroup, FormBuilder, Validators, NgForm } from '@angular/forms';
import { DeviceService } from '../../service/device.service';
import { Router } from '@angular/router';
import { SwalComponent } from '@toverux/ngx-sweetalert2';
import { ProfileInfo } from '../../model/profileInfo';
import { Device } from '../../model/device';
import { DeviceType } from '../../model/deviceType';
import { WidgetRequest } from '../../model/widgetRequest';
import { AsyncLocalStorage } from 'angular-async-local-storage';
import { environment } from '../../../environments/environment';
import { LoggerService } from '../../service/logger.service';
import { StatsService } from '../../service/stats.service';
import { BlockUI, NgBlockUI } from 'ng-block-ui';
import * as moment from 'moment';
import * as _ from 'underscore';
import { allSettled } from 'q';
declare var jquery: any;
declare var $: any;
declare var swal: any;

@Component({
    selector: 'app-ratchet-widgets',
    templateUrl: './widgets.component.html'
})
export class WidgetsComponent implements OnInit, OnDestroy { // implements LoggedInCallback {

    public title: string = 'Device Widgets';
    public deviceStats: any = {};
    private profile: ProfileInfo;
    public devices: Device[] = [];
    public deviceTypes: DeviceType[] = [];
    private allSelected: boolean = false;
    private pollerInterval: any = null;
    public widgetRequest: WidgetRequest = new WidgetRequest();
    public provisionCountError: boolean = false;
    public pages: any = {
        current: 1,
        total: 0,
        pageSize: 20
    };
    public metrics: any = {
        total: 0,
        running: 0,
        provisioning: 0,
        sleeping: 0
    };

    @BlockUI() blockUI: NgBlockUI;

    constructor(public router: Router,
        private deviceService: DeviceService,
        protected localStorage: AsyncLocalStorage,
        private logger: LoggerService,
        private statsService: StatsService,
        private _ngZone: NgZone) {
    }

    ngOnInit() {

        this.blockUI.start('Loading devices...');

        const _self = this;
        this.statsService.statObservable$.subscribe(message => {
            this.deviceStats = message;
            this._ngZone.run(() => { });
        });

        this.localStorage.getItem<ProfileInfo>('profile').subscribe((profile) => {
            _self.profile = new ProfileInfo(profile);
            _self.loadDevices();
            this.pollerInterval = setInterval(function() {
                _self.loadDevices();
            }, environment.refreshInterval);
        });

    }

    ngOnDestroy() {
        this.logger.info('destroying widgets page, attempting to remove poller.');
        clearInterval(this.pollerInterval);
    }

    loadDevices() {
        const _self = this;
        this.deviceService.getDeviceStats('custom widget').then((data: any) => {
            this.metrics = data;
            this.pages.total = Math.ceil(data.total / this.pages.pageSize);
            this.deviceService.getAllDevices((this.pages.current - 1), 'custom widget').then((devices: Device[]) => {
                this.blockUI.stop();
                this.devices = devices;
            }).catch((err) => {
                this.blockUI.stop();
                swal(
                    'Oops...',
                    'Something went wrong! Unable to retrieve your widgets.',
                    'error');
                _self.logger.error('error occurred calling getAllDevices api, show message');
                _self.logger.error(err);
            });
        }).catch((err) => {
            this.blockUI.stop();
            swal(
                'Oops...',
                'Something went wrong! Unable to retrieve your widget statistics.',
                'error');
            _self.logger.error('error occurred calling getDeviceStats api, show message');
            _self.logger.error(err);
        });
    }

    refreshData() {
        this.blockUI.start('Loading device types...');
        this.loadDevices();
    }

    openDevice(deviceId: string) {
        this.router.navigate([['/securehome/general', deviceId].join('/')]);
    }

    selectAll() {
        const _self = this;
        this.devices.forEach(function(d) {
            d.isSelected = _self.allSelected;
        });
    }

    getSelectedCount() {
        const _devices = _.where(this.devices, {
            isSelected: true
        });
        return (_devices.length > 0);
    }

    startSelectedDevices() {
        const _self = this;
        this.blockUI.start('Starting devices...');
        this.allSelected = false;
        const _devices = _.where(this.devices, {
            isSelected: true,
            stage: 'sleeping'
        });

        let _counter = 0;
        let _errors = 0;
        if (_devices.length > 0) {
            _devices.forEach(function(device) {
                if(device.isSelected) {
                    _self.startDevice(device).then(() => {
                        _counter++;
                        if(_counter === _devices.length) {
                            if (_errors > 0) {
                                _self.blockUI.stop();
                                swal(
                                    'Oops...',
                                    'Unable to start some of the selected widgets.',
                                    'info');
                                _self.logger.error('error occurred starting selected devices, show message');
                            }
                            _self.loadDevices();
                            _self.statsService.refresh();
                        }
                    }).catch((err) => {
                        _counter++;
                        _self.logger.error(err);
                        _errors++;
                        if(_counter === _devices.length) {
                            _self.blockUI.stop();
                            swal(
                                'Oops...',
                                'Unable to start some of the selected widgets.',
                                'info');
                            _self.logger.error('error occurred starting selected devices, show message');
                            _self.loadDevices();
                            _self.statsService.refresh();
                        }
                    });
                }
            });
        } else {
            this.devices.forEach(function(d) {
                d.isSelected = false;
            });
            this.blockUI.stop();
        }
 
    }

    startWidget(deviceId) {
        this.blockUI.start('Starting device...');
        const device = _.where(this.devices, {
            id: deviceId
        });

        if (device.length > 0) {
            this.startDevice(device[0]).then(() => {
                this.loadDevices();
                this.statsService.refresh();
            }).catch((err) => {
                this.blockUI.stop();
                swal(
                    'Oops...',
                    'Something went wrong! Unable to start the widget.',
                    'error');
                this.logger.error('error occurred calling updateDevice api, show message');
                this.logger.error(err);
                this.loadDevices();
            });
        } else {
            this.blockUI.stop();
            this.loadDevices();
        }
    }

    private startDevice(device: Device) {
        const promise = new Promise((resolve, reject) => {
            if (device.stage === 'sleeping') {
                device.operation = 'hydrate';
                this.deviceService.updateDevice(device).then((resp: any) => {
                    resolve();
                }).catch((err) => {
                    reject(err);
                });
            }
        });
        return promise;
    }

    stopDevice(deviceId: string) {
        this.blockUI.start('Stopping device...');
        const _self = this;
        const device = _.where(this.devices, {
            id: deviceId
        });

        if (device.length > 0) {
            if (device[0].stage === 'hydrated') {
                device[0].operation = 'stop';
                this.deviceService.updateDevice(device[0]).then((resp: any) => {
                    _self.loadDevices();
                }).catch((err) => {
                    this.blockUI.stop();
                    swal(
                        'Oops...',
                        'Something went wrong! Unable to stop the widget.',
                        'error');
                    this.logger.error('error occurred calling updateDevice api, show message');
                    this.logger.error(err);
                    this.loadDevices();
                });
            }
        }
    }

    deleteDevice(deviceId: string) {
        const _self = this;
        swal({
            title: 'Are you sure you want to delete this widget?',
            text: 'You won\'t be able to revert this!',
            type: 'question',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it!'
        }).then((result) => {
            if (result.value) {
                _self.blockUI.start('Deleting device...');

                _self.deviceService.deleteDevice(deviceId).then((resp: any) => {
                    _self.loadDevices();
                }).catch((err) => {
                    _self.blockUI.stop();
                    swal(
                        'Oops...',
                        'Something went wrong! Unable to delete the widget.',
                        'error');
                    _self.logger.error('error occurred calling deleteDevice api, show message');
                    _self.logger.error(err);
                    _self.loadDevices();
                });
            }
        });
    }

    formatDate(dt: string) {
        if (dt) {
            return moment(dt).format('MMM Do YYYY');
        } else {
            return '';
        }
    }

    nextPage() {
        this.pages.current++;
        this.blockUI.start('Loading devices...');
        this.loadDevices();
    }

    previousPage() {
        this.pages.current--;
        this.blockUI.start('Loading devices...');
        this.loadDevices();
    }

    openWidgetModal() {
        this.widgetRequest = new WidgetRequest();
        this.provisionCountError = false;
        this.blockUI.start('Loading...');
        this.deviceService.getDeviceTypes(0).then((types: DeviceType[]) => {
            if (types.length > 0) {
                this.deviceTypes = types;
                this.widgetRequest.typeId = types[0].typeId;
                $('#addModal').modal('show');
            } else {
                swal(
                    'Oops...',
                    'Something went wrong! You currently have no device types defined.',
                    'error');
            }
            this.blockUI.stop();
        }).catch((err) => {
            this.blockUI.stop();
            swal(
                'Oops...',
                'Something went wrong! Unable to retrieve the devices.',
                'error');
            this.logger.error('error occurred calling getDeviceTypes api, show message');
            this.logger.error(err);
        });
    }

    addWidget(w: WidgetRequest) {
        this.provisionCountError = false;
        if (w.count > 25) {
            this.provisionCountError = true;
            return;
        }
        $('#addModal').modal('hide');
        this.blockUI.start('Provisioning device...');
        if (w.typeId) {
            this.deviceService.createDevice(w).then((resp: any) => {
                this.loadDevices();
                this.statsService.refresh();
            }).catch((err) => {
                this.blockUI.stop();
                swal(
                    'Oops...',
                    'Something went wrong! Unable to create the new device.',
                    'error');
                this.logger.error('error occurred calling createDevice api, show message');
                this.logger.error(err);
                this.loadDevices();
            });
        }
    }

    cancelAdd() {
        $('#addModal').modal('hide');
    }

}
