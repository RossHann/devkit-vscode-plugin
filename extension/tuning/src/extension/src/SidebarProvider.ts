import * as vscode from "vscode";
import { getNonce } from "./getNonce";

export class SidebarProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'vscodevuerollup:sidebar';

    private _view?: vscode.WebviewView;

    constructor(private readonly _extensionUri: vscode.Uri) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            // Allow scripts in the webview
            enableScripts: true,

            localResourceRoots: [
                this._extensionUri
            ],
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case "message": {
                    if (!data.value) {
                        return;
                    }
                    vscode.window.showInformationMessage(data.value);
                    break;
                }
                case "openApp": {
                    await vscode.commands.executeCommand(
                        'vscodevuerollup:openVueApp', { ...data }
                    );
                    break;
                }
                case "onInfo": {
                    if (!data.value) {
                        return;
                    }
                    vscode.window.showInformationMessage(data.value);
                    break;
                }
                case "onError": {
                    if (!data.value) {
                        return;
                    }
                    vscode.window.showErrorMessage(data.value);
                    break;
                }
            }
        });
    }

    public revive(panel: vscode.WebviewView) {
        this._view = panel;
    }

    public sendMessage() {
        return vscode.window.showInputBox({
            prompt: 'Enter your message',
            placeHolder: 'Hey Sidebar!'
        }).then(value => {
            if (value) {
                this.postWebviewMessage({
                    command: 'message',
                    data: value,});
            }
        });
    }
    private postWebviewMessage(msg: {
        command: string,
        data?: any
    }) {
        vscode.commands.executeCommand(
            'workbench.view.extension.vscodevuerollup-sidebar-view');
        vscode.commands.executeCommand('workbench.action.focusSideBar');

        this._view?.webview.postMessage(msg);
    }

    private _getHtmlForWebview(webview: vscode.Webview)
    {
        const styleResetUri = webview.asWebviewUri(
            vscode.Uri.joinPath(
                this._extensionUri, "media", "reset.css")
        );

        const styleVSCodeUri = webview.asWebviewUri(
            vscode.Uri.joinPath(
                this._extensionUri, "media", "vscode.css")
        );

        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(
                this._extensionUri, "dist-web", "sidebar.js")
        );

        const styleMainUri = webview.asWebviewUri(
            vscode.Uri.joinPath(
                this._extensionUri, "dist-web", "sidebar.css")
        );

        const nonce = getNonce();

        return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, 
                                                 initial-scale=1" />  
                <link href="${styleResetUri}" rel="stylesheet">
                <link href="${styleVSCodeUri}" rel="stylesheet">
                <link href="${styleMainUri}" rel="stylesheet">  
                <title>Web Pages Panel</title>
                <script nonce="${nonce}">    
                    const vscode = acquireVsCodeApi();
                </script>
        </head>     
        <body>
            <div id="app"></div>
            <script src="${scriptUri}" nonce="${nonce}">
        </body>
        </html>   
    `;
    }
}
