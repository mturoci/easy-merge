/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import MergeConflictServices from "./services";

function overrideCommand(
  context: vscode.ExtensionContext,
  command: string,
  callback: (...args: any[]) => any
) {
  const disposable = vscode.commands.registerCommand(command, async (args) => {
    // if (configuration.disableExtension) {
    //   return vscode.commands.executeCommand('default:' + command, args);
    // }

    if (!vscode.window.activeTextEditor) {
      return;
    }

    if (
      vscode.window.activeTextEditor.document &&
      vscode.window.activeTextEditor.document.uri.toString() === 'debug:input'
    ) {
      return vscode.commands.executeCommand('default:' + command, args);
    }

    return callback(args);
  });
  context.subscriptions.push(disposable);
}
export function activate(context: vscode.ExtensionContext) {
  // Register disposables
  const services = new MergeConflictServices(context);
  services.begin();
  context.subscriptions.push(services);
  // overrideCommand(context, 'type', () => {
  //   console.log('woou');
  // })
  // vscode.commands.registerCommand('type', (args) => {
  //   console.log(`type with args`, args);
  //   return vscode.commands.executeCommand('default:type', args);
  // });
}

export function deactivate() { }