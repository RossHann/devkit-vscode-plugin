import * as vscode from 'vscode';
import { Utils } from './utils';
import { ToolPanelManager } from './panel-manager';
import * as sidebar from './sidebar/TreeViewProvider';
import {SidebarProvider} from "./SidebarProvider";

export function activate(context: vscode.ExtensionContext) {
   // 响应VSCode配置修改
   Utils.addConfigListening();
   // 清除Vscode缓存信息
   Utils.initVscodeCache(context, true);
   // 响应perfadvisor左侧菜单树所有按钮的命令来打开不同的webview
   ToolPanelManager.createOrShowPanelForPerfCommand(context);
   const sidebar_test = new sidebar.TreeViewProvider();
   vscode.window.registerTreeDataProvider("perfadvisorTools", sidebar_test);
   // vscode.commands.executeCommand('setContext', 'ipconfig', true);
   // var thisProvider = {
   //    resolveWebviewView: function (thisWebview: any, thisWebviewContext: any, thisToken: any){
   //       thisWebview.webview.options={enableScripts: true};
   //       thisWebview.webview.html="<!doctype><html><body><h1>试一试</h1></body>";
   //    }
   // };
   // vscode.window.registerWebviewViewProvider('perfadvisorTools', thisProvider);
   // const sidebar_test = new SidebarProvider(context.extensionUri);
   // vscode.window.registerWebviewViewProvider("perfadvisorTools", sidebar_test);
}

export function deactivate() { }
