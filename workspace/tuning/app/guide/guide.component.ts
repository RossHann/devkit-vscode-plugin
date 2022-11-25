import { I18nService, LANGUAGE_TYPE } from '../service/i18n.service';
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { COLOR_THEME, VscodeService } from '../service/vscode.service';
import { DomSanitizer } from '@angular/platform-browser';

@Component({
    selector: 'app-guide',
    templateUrl: './guide.component.html',
    styleUrls: ['./guide.component.scss']
})
export class GuideComponent implements OnInit {
    public i18n: any;
    public guideList: any;
    public currLang: any;
    // 主题颜色
    public colorTheme = {
        Dark: COLOR_THEME.Dark,
        Light: COLOR_THEME.Light
    };
    public currTheme = COLOR_THEME.Dark;

    constructor(
        private i18nService: I18nService,
        private vscodeService: VscodeService,
        private changeDetectorRef: ChangeDetectorRef,
        public sanitizer: DomSanitizer
    ) {
        this.i18n = this.i18nService.I18n();
    }
    ngOnInit() {
        // 获取当前语言
        this.currLang = I18nService.getLang();
        // vscode颜色主题适配
        if (document.body.className.indexOf('vscode-light') > -1) {
            this.currTheme = COLOR_THEME.Light;
        }
        this.vscodeService.regVscodeMsgHandler('colorTheme', (msg: any) => {
            this.currTheme = msg.colorTheme;
            this.changeDetectorRef.markForCheck();
            this.changeDetectorRef.detectChanges();
        });

        this.initGuideList()
    }

    private initGuideList() {
        this.guideList = [
            {
                id: 'install_serve',
                numberIcon: {
                    dark: './assets/img/guide/number-one-dark.png',
                    light: './assets/img/guide/number-one-light.png'
                },
                icon: {
                    dark: './assets/img/guide/install-serve-dark.png',
                    light: './assets/img/guide/install-serve-light.png'
                },
                arrowIcon: './assets/img/banner/arrow-hover.svg',
                title: this.i18n.plugins_common_guide.install_serve,
                info: this.i18n.plugins_common_guide.install_serve_info,
                linkBtnText: this.i18n.plugins_common_guide.install_now,
                urlId: 0
            },
            {
                id: 'config_serve',
                numberIcon: {
                    dark: './assets/img/guide/number-two-dark.png',
                    light: './assets/img/guide/number-two-light.png'
                },
                icon: {
                    dark: './assets/img/guide/config-serve-dark.png',
                    light: './assets/img/guide/config-serve-light.png'
                },
                arrowIcon: './assets/img/banner/arrow-hover.svg',
                title: this.i18n.plugins_common_guide.config_serve,
                info: this.i18n.plugins_common_guide.config_serve_info,
                linkBtnText: this.i18n.plugins_common_guide.config_now,
                urlId: 1
            },
        ];
    }

    /**
     * 打开部署服务器页面
     */
     openConfigPage() {
        const cmdData = {
            cmd: 'openNewPage',
            data: {
                router: 'install',
                panelId: 'tuningNonServerInstall',
                viewTitle: this.i18n.plugins_tuning_configure_remote_server,
                message: {}
            }
        };
        this.vscodeService.postMessage(cmdData, null);
    }

    /**
     * 打开配置服务器页面
     */
     openInstallPage() {
        const cmdData = {
            cmd: 'openNewPage',
            data: {
                router: 'config',
                panelId: 'tuningNonServerConfig',
                viewTitle: this.i18n.plugins_tuning_configure_remote_server,
                message: {}
            }
        };
        this.vscodeService.postMessage(cmdData, null);
    }

}
