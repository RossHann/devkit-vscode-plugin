import * as vscode from 'vscode';
import * as constant from './constant';
import { Utils } from './utils';
import { ToolPanelManager } from './panel-manager';
import { I18nService } from './i18nservice';
import { SSH2Tools } from './ssh2Tools';
import { ErrorHelper } from './error-helper';
import { ProxyManager } from './proxy-manager';
const fs = require('fs');
const i18n = I18nService.I18n();
let terminalStatusInterval: any;
let terminalCloseEvent: any;

export const messageHandler = {
    // 从配置文件读取ip与port
    readConfig(global: any, message: any) {
        const json = Utils.getConfigJson(global.context);
        Utils.invokeCallback(global.toolPanel.getPanel(), message, json);
    },

    // 从配置文件读取url
    readUrlConfig(global: any, message: any) {
        const json = Utils.getURLConfigJson(global.context);
        Utils.invokeCallback(global.toolPanel.getPanel(), message, json);
    },

    // 保存ip与port到json配置文件
    async saveConfig(global: any, message: any) {
        // console.log("GLOBAL.context at messagehandler");
        // console.log(global.context);
        // console.log("GLOBAL.toolPanel at messagehandler");
        // console.log(global.toolPanel);
        // console.log("Content of message.data.openConfigServer");
        // console.log(message);
        if (!message.data.openConfigServer) {  // 点击弹窗中的是openConfigServer为true
            // console.log("Position 0.");
            if (ToolPanelManager.loginPanels.length > 0) {
                // 弹窗提示是否切换服务器
                // console.log("Position 1.");
                const panel = global.toolPanel.getPanel();
                // console.log("Position 2.");
                panel.webview.postMessage({ cmd: 'handleVscodeMsg', type: 'showCustomDialog', data: { show: true } });
                // console.log("Position 3.");
                return;
            }
        }
        // console.log("Checkpoint after the first if");
        let tuningConfig;
        try {
            tuningConfig = JSON.parse(message.data.data).tuningConfig;
            // console.log("Position 4.");
        } catch (err) {
            tuningConfig = {};
        }
        // console.log("Position 5.");
        const tuningConfigObj = Array.isArray(tuningConfig) ? tuningConfig[0] : tuningConfig;
        // console.log("Position 6.")
        let data: any;
        // console.log("Position 7.")
        const resourcePath = Utils.getExtensionFileAbsolutePath(global.context, 'out/assets/config.json');
        // console.log("Position 8.")
        // console.log(resourcePath);
        // console.log(message.data.data);
        // console.log("Position 8.5.");
        data = fs.writeFileSync(resourcePath, message.data.data);
        global.context.globalState.update('tuningIp', tuningConfigObj.ip);
        // console.log("Position 10.")
        global.context.globalState.update('tuningPort', tuningConfigObj.port);
        // console.log("Position 11.")
        const { proxyServerPort, proxy } =
            await ProxyManager.createProxyServer(global.context, tuningConfigObj.ip, tuningConfigObj.port);
        // console.log("Position 12.")
        global.context.globalState.update('defaultPort', proxyServerPort);

        // console.log("Position 13.")
        const queryVersionOptions = {
            url: `http://127.0.0.1:${proxyServerPort}/user-management/api/v2.2/users/version/`,
            method: 'GET'
        };
        // console.log("Position 14.")
        const respVersion: any = await Utils.requestData(global.context, queryVersionOptions as any, message.module);
        // console.log("Position 15.")
        if (respVersion.status === constant.HTTP_STATUS.HTTP_200_OK) {
            const serverVersion = respVersion?.data?.data?.version;

            if (!Utils.checkVersion(global.context, serverVersion)) {
                proxy.close();
                const configVersion = Utils.getConfigJson(global.context).configVersion[0];
                // 版本不匹配
                data = { type: 'VERSIONMISMATCH', configVersion, serverVersion };
                Utils.invokeCallback(global.toolPanel.getPanel(), message, data);
                return;
            }
            const queryOptions = {
                url: `http://127.0.0.1:${proxyServerPort}/user-management/api/v2.2/users/admin-status/`,
                method: 'GET'
            };
            const resp: any = await Utils.requestData(global.context, queryOptions as any, message.module);
            if (resp.status === constant.HTTP_STATUS.HTTP_200_OK) {
                vscode.commands.executeCommand('setContext', 'ipconfig', true);
                vscode.commands.executeCommand('setContext', 'isPerfadvisorConfigured', true);
                Utils.invokeCallback(global.toolPanel.getPanel(), message, data);
                ToolPanelManager.closeLoginPanel();
                if (message.data.openLogin){
                    Utils.navToIFrame(global, proxyServerPort, proxy);
                }
                const nlsPath = Utils.getExtensionFileAbsolutePath(global.context, './package.nls.json');
                const enNlsPath = Utils.getExtensionFileAbsolutePath(global.context, './package.nls.en.json');
                const configData = JSON.parse(fs.readFileSync(nlsPath, 'utf-8'));
                const configDataEn = fs.readFileSync(enNlsPath, 'utf-8');
                console.log('CN nls');
                console.log(configData);
                // console.log('EN nls');
                // console.log(configDataEn);
                let newContent = this.updateIpAndPortCN(global, configData);
                console.log('before write');
                console.log(newContent)
                fs.writeFileSync(nlsPath, JSON.stringify(newContent))
                console.log(fs.readFileSync(nlsPath, 'utf-8'))
            } else {
                proxy.close();
                Utils.invokeCallback(global.toolPanel.getPanel(), message, data);
            }
        } else {
            proxy.close();
            Utils.invokeCallback(global.toolPanel.getPanel(), message, data);
        }
    },
    /**
     * 更新ip与端口的显示内容
     * @param originalContent 更新之前的
     */
    updateIpAndPortCN(global:any, originalContent: any){
        let newConfigPath = Utils.getExtensionFileAbsolutePath(global.context, 'out/assets/config.json');
        let data = JSON.parse(fs.readFileSync(newConfigPath));
        console.log('Here is new config');
        console.log(data.tuningConfig[0].ip);
        console.log('Here is old config');
        console.log(originalContent.ip_address_port);
        var temp = 'IP地址'+' '+JSON.stringify(data.tuningConfig[0].ip).substring(1, JSON.stringify(data.tuningConfig[0].ip).length - 1)+'\n'+
                   '端口'+'   '+JSON.stringify(data.tuningConfig[0].port).substring(1, JSON.stringify(data.tuningConfig[0].port).length - 1);
        originalContent.ip_address_port = temp;
        console.log('Here is changed config');
        console.log(temp);
        console.log(originalContent);
        return originalContent;
    },
    /**
     * 登录指令请求跳转登录页面
     * @param global global
     * @param message message
     */
    async openLoginByButton(global: any) {
        const resourcePath = Utils.getExtensionFileAbsolutePath(global.context, 'out/assets/config.json');
        const configData = fs.readFileSync(resourcePath);
        let tuningConfig;
        try {
            tuningConfig = JSON.parse(configData).tuningConfig;
        } catch (err) {
            tuningConfig = {};
        }
        const tuningConfigObj = Array.isArray(tuningConfig) ? tuningConfig[0] : tuningConfig;
        // tslint:disable-next-line:max-line-length
        const { proxyServerPort, proxy } = await ProxyManager.createProxyServer(global.context, tuningConfigObj.ip, tuningConfigObj.port);
        Utils.navToIFrame(global, proxyServerPort, proxy);
        console.log('before calling')
        vscode.commands.executeCommand('extension.view.perfadvfreetrialremoteenvironment')
        console.log('after callling')
        ToolPanelManager.closePanelsByRemained('tuning', []);
    },

    /**
     * 打开新的vscode窗口
     *
     * @param global 全局上下文
     * @param message 消息内容
     */
    openNewPage(global: any, message: any) {
        const session = {
            language: vscode.env.language
        };
        let navMessage;
        if ('message' in message.data) {
            navMessage = Utils.generateMessage('navigate', {
                page: '/' + message.data.router, pageParams: { queryParams: message.data.message }, webSession: session
            });
        } else {
            navMessage = Utils.generateMessage('navigate', {
                page: '/' + message.data.router, webSession: session
            });
        }
        const viewTitle = message.data.viewTitle;
        const panelOption = {
            panelId: message.data.panelId,
            viewType: message.data.viewType || message.module,
            viewTitle,
            module: message.module,
            message: navMessage,
        };
        ToolPanelManager.createOrShowPanel(panelOption, global.context);
    },
    // 关闭panel
    closePanel(global: any, message: any) {
        ToolPanelManager.closePanel(global.toolPanel.getPanelId(), message.module);
    },

    // 检查ssh连接是否通畅
    async checkConn(global: any, message: any) {
        const ssh2Tools = new SSH2Tools();
        const sshCheckResult = await ssh2Tools.sshClientCheck();
        if (!sshCheckResult) {
            Utils.showMessageByType('warn', { info: i18n.plugins_common_message_sshClientCheck }, true);
            Utils.invokeCallback(global.toolPanel.getPanel(), message, '');
            this.clearPwd(message.data.password);
            this.clearPwd(message.data.privateKey);
            return;
        }
        let server: any = {};
        if (message.data.sshType === 'usepwd') {
            server = {
                host: message.data.host,
                port: message.data.port,
                username: message.data.username,
                password: message.data.password,
                hostHash: 'sha256',
                hostVerifier: (hashedKey: any, callback1: any) => {
                    const finger = Utils.getConfigJson(global.context).hostVerifier;
                    const tempip = message.data.host;
                    Utils.fingerCheck(global, tempip, hashedKey, finger).then((data: any) => {
                        callback1(data);
                    });
                }
            };
        } else {
            // 检测秘钥文件是否有秘钥短语
            if (!ssh2Tools.checkRealExistPassphrase(message.data)) {
                vscode.window.showErrorMessage(I18nService.I18n().plugins_common_tips_connFail);
                Utils.invokeCallback(global.toolPanel.getPanel(), message, '');
                return;
            }
            server = {
                host: message.data.host,
                port: message.data.port,
                username: message.data.username,
                privateKey: fs.readFileSync(message.data.privateKey),
                passphrase: message.data.passphrase,
                hostHash: 'sha256',
                hostVerifier: (hashedKey: any, callback1: any) => {
                    const finger = Utils.getConfigJson(global.context).hostVerifier;
                    const tempip = message.data.host;
                    Utils.fingerCheck(global, tempip, hashedKey, finger).then((data: any) => {
                        callback1(data);
                    });
                }
            };
        }
        Utils.fingerLengthCheck(global);
        const callback = (data: any) => {
            if (data instanceof Error) {
                if (data.message.search(/ETIMEDOUT/) !== -1 || data.message.search(/ECONNREFUSED/) !== -1) {
                    ErrorHelper.errorHandler(global.context, message.module, data.message, server.host);
                } else if (data.message.search(/no matching/) !== -1) {
                    vscode.window.showErrorMessage(i18n.plugins_common_message_sshAlgError);
                }
                Utils.invokeCallback(global.toolPanel.getPanel(), message, data.toString());
            } else {
                Utils.invokeCallback(global.toolPanel.getPanel(), message, data);
            }
        };
        new SSH2Tools().connectTest(server, () => { }, callback);
        this.clearPwd(message.data.password);
        this.clearPwd(message.data.privateKey);
    },
    /**
     * 密码释放
     * @param message: 来自webview的消息内容
     */
    clearPwd(password: any) {
        password = '';
        password = '';
        password = '';
    },

    /**
     * webview侧发消息给vscode发消息需在右下角弹提醒框
     * @param global 插件上下文,以及当前的panel
     * @param message 来自webview的提示内容{info:弹框显示的信息, type:弹框级别,{error,info,warn}}
     */
    async showInfoBox(global: any, message: any) {
        Utils.showMessageByType(message.data.type, { info: message.data.info }, true);
    },

    /**
     * 升级后台服务器
     *
     * @param global 全局上下文
     * @param message 消息内容
     */
    async upgrade(global: any, message: any) {
        let server: any = {};
        let terminal: vscode.Terminal;
        const ssh2Tools = new SSH2Tools();
        if (message.data.sshType === 'usepwd') {
            server = {
                host: message.data.host,
                port: message.data.port,
                username: message.data.username,
                password: message.data.password,
            };
        } else {
            server = {
                host: message.data.host,
                port: message.data.port,
                username: message.data.username,
                privateKey: fs.readFileSync(message.data.privateKey),
                passphrase: message.data.passphrase
            };
        }

        // 流程处理回调函数
        const processHandler = (data: any) => {
            if (data instanceof Error) {
                message.module = 'tuning';
                Utils.invokeCallback(global.toolPanel.getPanel(), message, 'Error:' + data.toString());
            } else if (typeof data === 'string') {
                if (data.search(/success|failed/) !== -1) {
                    clearInterval(terminalStatusInterval);
                    if (terminalCloseEvent) { terminalCloseEvent.dispose(); }
                    ssh2Tools.closeConnect();
                    if (data.search(/success/) !== -1) {
                        // 延迟1秒隐藏终端
                        setTimeout(() => { terminal.hide(); }, 1000);
                    }
                }
                Utils.invokeCallback(global.toolPanel.getPanel(), message, data);
            }
        };

        // 建立连接
        await ssh2Tools.connect(server).catch(processHandler);
        message.module = 'sysPerf';
        // 上传脚本文件
        const timestamp = Utils.formatDatetime(message.data.startUpgradeDatetime, 'yy_M_d_h_m_s');
        const workDir = '/tmp/vscode' + '_' + timestamp + '/';
        await ssh2Tools.mkdir(workDir, { mode: '700' }).catch(processHandler);
        const preShellName = 'upgrade_' + message.module + '.sh';
        const shellName = message.module + '_upgrade.sh';
        const preShellPromise = ssh2Tools.writeFile(preShellName, workDir + preShellName);
        const shellPromise = ssh2Tools.writeFile(shellName, workDir + shellName);
        await Promise.all([preShellPromise, shellPromise]).catch(processHandler);

        // 创建终端
        terminal = vscode.window.createTerminal();
        // 创建终端，关闭upgrade页面loading
        Utils.invokeCallback(global.toolPanel.getPanel(), message, 'closeLoading');
        // 创建终端异常退出处理
        handleTerminalException(terminal, ssh2Tools, [workDir + preShellName, workDir + shellName],
            (clearError) => {
                const text = 'upgrade clear error: ' + clearError;
            }, processHandler);
        // 显示终端，开始部署
        terminal.show();
        terminal.sendText('ssh -t -p' + server.port + ' ' + server.username +
            '@' + server.host + ' bash ' + workDir + preShellName + ' -u ' + this.getUrl(global) +
            ' -c "' + this.getKeyUrl(global) + '" \n');

        // 查询是否部署完成
        const stepName = '.upgrade_' + message.module + '.step';
        ssh2Tools.tailFlow(workDir + stepName, processHandler).catch(processHandler);
        // 添加关闭连接前事件
        ssh2Tools.onCloseBefore = () => {
            return ssh2Tools.exec('rm -rf ' + workDir + stepName);
        };
        // 清除用户信息
        server = undefined;
        message.data.username = undefined;
        message.data.password = undefined;
    },
    /**
     * 安装后台服务器
     *
     * @param global 全局上下文
     * @param message 消息内容
     */
    async install(global: any, message: any) {
        let server: any = {};
        let terminal: vscode.Terminal;
        const ssh2Tools = new SSH2Tools();
        if (message.data.sshType === 'usepwd') {
            server = {
                host: message.data.host,
                port: message.data.port,
                username: message.data.username,
                password: message.data.password,
            };
        } else {
            server = {
                host: message.data.host,
                port: message.data.port,
                username: message.data.username,
                privateKey: fs.readFileSync(message.data.privateKey),
                passphrase: message.data.passphrase
            };
        }

        // 流程处理回调函数
        const processHandler = (data: any) => {
            if (data instanceof Error) {
                message.module = 'tuning';
                Utils.invokeCallback(global.toolPanel.getPanel(), message, 'Error:' + data.toString());
            } else if (typeof data === 'string') {
                if (data.search(/success|failed/) !== -1) {
                    clearInterval(terminalStatusInterval);
                    if (terminalCloseEvent) { terminalCloseEvent.dispose(); }
                    ssh2Tools.closeConnect();
                    if (data.search(/success/) !== -1) {
                        // 延迟1秒隐藏终端
                        setTimeout(() => { terminal.hide(); }, 1000);
                    }
                }
                Utils.invokeCallback(global.toolPanel.getPanel(), message, data);
            }
        };

        // 建立连接
        await ssh2Tools.connect(server).catch(processHandler);
        message.module = 'sysPerf';
        // 上传脚本文件
        const timestamp = Utils.formatDatetime(message.data.startInstallDatetime, 'yy_M_d_h_m_s');
        const workDir = '/tmp/vscode' + '_' + timestamp + '/';
        await ssh2Tools.mkdir(workDir, { mode: '700' }).catch(processHandler);
        const preShellName = 'deploy_' + message.module + '.sh';
        const shellName = 'write_' + message.module + '_log.sh';
        const preShellPromise = ssh2Tools.writeFile(preShellName, workDir + preShellName);
        const shellPromise = ssh2Tools.writeFile(shellName, workDir + shellName);
        await Promise.all([preShellPromise, shellPromise]).catch(processHandler);

        // 创建终端
        terminal = vscode.window.createTerminal();
        // 创建终端，关闭install页面loading
        Utils.invokeCallback(global.toolPanel.getPanel(), message, 'closeLoading');
        // 创建终端异常退出处理
        handleTerminalException(terminal, ssh2Tools, [workDir + preShellName, workDir + shellName],
            (clearError) => {
                const text = 'install clear error: ' + clearError;
            }, processHandler);
        // 显示终端，开始部署
        terminal.show();
        terminal.sendText('ssh -t -p' + server.port + ' ' + server.username +
            '@' + server.host + ' bash ' + workDir + preShellName + ' -u ' + this.getUrl(global) +
            ' -c "' + this.getKeyUrl(global) + '" \n');

        // 查询是否部署完成
        const stepName = '.install_' + message.module + '.step';
        ssh2Tools.tailFlow(workDir + stepName, processHandler).catch(processHandler);
        // 添加关闭连接前事件
        ssh2Tools.onCloseBefore = () => {
            return ssh2Tools.exec('rm -rf ' + workDir + stepName);
        };
        // 清除用户信息
        server = undefined;
        message.data.username = undefined;
        message.data.password = undefined;
    },
    /**
     * 卸载后台服务器
     *
     * @param global 全局上下文
     * @param message 消息内容
     */
    async uninstall(global: any, message: any) {
        let server: any = {};
        let terminal: vscode.Terminal;
        const ssh2Tools = new SSH2Tools();
        if (message.data.sshType === 'usepwd') {
            server = {
                host: message.data.host,
                port: message.data.port,
                username: message.data.username,
                password: message.data.password,
            };
        } else {
            server = {
                host: message.data.host,
                port: message.data.port,
                username: message.data.username,
                privateKey: fs.readFileSync(message.data.privateKey),
                passphrase: message.data.passphrase
            };
        }

        // 流程处理回调函数
        const processHandler = (data: any) => {
            if (data instanceof Error) {
                message.module = 'tuning';
                Utils.invokeCallback(global.toolPanel.getPanel(), message, 'Error:' + data.toString());
            } else if (typeof data === 'string') {
                if (data.search(/success|failed/) !== -1) {
                    clearInterval(terminalStatusInterval);
                    if (terminalCloseEvent) { terminalCloseEvent.dispose(); }
                    ssh2Tools.closeConnect();
                    if (data.search(/success/) !== -1) {
                        // 延迟1秒隐藏终端
                        setTimeout(() => { terminal.hide(); }, 1000);
                    }
                }
                Utils.invokeCallback(global.toolPanel.getPanel(), message, data);
            }
        };

        // 建立连接
        await ssh2Tools.connect(server).catch(processHandler);
        message.module = 'sysPerf';
        // 上传脚本文件
        const timestamp = Utils.formatDatetime(message.data.startUninstallDatetime, 'yy_M_d_h_m_s');
        const workDir = '/tmp/vscode' + '_' + timestamp + '/';
        await ssh2Tools.mkdir(workDir, { mode: '700' }).catch(processHandler);
        const preShellName = 'uninstall_' + message.module + '.sh';
        const shellName = message.module + '_log.sh';
        const preShellPromise = ssh2Tools.writeFile(preShellName, workDir + preShellName);
        const shellPromise = ssh2Tools.writeFile(shellName, workDir + shellName);
        await Promise.all([preShellPromise, shellPromise]).catch(processHandler);
        // 创建终端
        terminal = vscode.window.createTerminal();
        // 创建终端，关闭uninstall页面loading
        Utils.invokeCallback(global.toolPanel.getPanel(), message, 'closeLoading');
        handleTerminalException(terminal, ssh2Tools, [workDir + preShellName, workDir + shellName],
            (clearError) => {
                const text = 'uninstall clear error: ' + clearError;
            }, processHandler);

        // 显示终端，开始卸载
        terminal.show();
        terminal.sendText('ssh -t -p' + server.port + ' ' + server.username + '@' + server.host +
            ' bash ' + workDir + preShellName + ' \n');

        // 查询是否卸载完成
        const stepName = '.uninstall_' + message.module + '.step';
        ssh2Tools.tailFlow(workDir + stepName, processHandler).catch(processHandler);
        // 添加关闭连接前事件
        ssh2Tools.onCloseBefore = () => {
            return ssh2Tools.exec('rm -rf ' + workDir + stepName);
        };
        // 清除用户信息
        server = undefined;
        message.data.username = undefined;
        message.data.password = undefined;
    },
    /**
     * 获取安装包路径
     */
    getUrl(global: any): any {
        return Utils.getConfigJson(global.context).pkg_url;
    },
    /**
     * 获取KEY路径
     */
    getKeyUrl(global: any): any {
        return Utils.getConfigJson(global.context).key;
    },

    // 清理json配置文件中的ip和port
    async cleanConfig(global: any, message: any) {
        global.context.globalState.update('closeShowErrorMessage', true);

        Utils.invokeCallback(global.toolPanel.getPanel(), message, { cleanOk: true });

        // 清空session缓存,并将新的配置更新到session中
        Utils.initVscodeCache(global.context);

        // 关闭其他页面
        ToolPanelManager.closePanelsByRemained(message.module, [global.toolPanel.getPanelId()]);
        global.context.globalState.update(message.module + 'uploadProcessFlag', 0);
    },

    // 关闭所有panel
    closeAllPanel(global: any, message: any) {
        this.closePanel(global, message);
    },
    /**
     * 隐藏terminal
     * @param global: 插件上下文，以及当前的panel
     * @param message: 来自webview的消息内容
     */
    hideTerminal(global: any, message: any) {
        vscode.window.activeTerminal?.hide();
    }
};

function handleTerminalException(
    terminal: vscode.Terminal, ssh2Tools: SSH2Tools,
    fileList: Array<string>, log: (data: string) => void, callback: any
) {

    const handleException = async () => {
        clearInterval(terminalStatusInterval);
        if (terminalCloseEvent) { terminalCloseEvent.dispose(); }
        // 非正常退出时才做处理
        if (ssh2Tools.status === 'connected') {
            let results: any;
            try {
                results = await ssh2Tools.clear(fileList, 3);
            } catch (err) {
                results = fileList.map(item => ({ item, error: 'sftp connected failed' }));
            }
            results.forEach((result: any) => {
                log(result.filePath + ': ' + result.error || 'success');
            });
            callback('terminal exception failed');
        }
    };

    let sshIsStart = false;
    clearInterval(terminalStatusInterval);
    if (terminalCloseEvent) { terminalCloseEvent.dispose(); }
    terminalStatusInterval = setInterval(() => {
        if (terminal.name === 'ssh') { sshIsStart = true; }
        if (sshIsStart && terminal.name !== 'ssh') {
            handleException();
        }
    }, 100);
    terminalCloseEvent = vscode.window.onDidCloseTerminal(async (t: any) => {
        const currProcessId = await t.processId;
        const processId = await terminal.processId;
        if (currProcessId === processId) {
            handleException();
        }
    });
}
