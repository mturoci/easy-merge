/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode"
import ContentProvider from "./contentProvider"
import MergeConflictServices from "./services"

export function activate(context: vscode.ExtensionContext) {
  // Register disposables
  const services = new MergeConflictServices(context)
  services.begin()
  context.subscriptions.push(services)
  vscode.window.onDidChangeTextEditorVisibleRanges(({ textEditor, visibleRanges }) => {
    const scheme = textEditor.document.uri.scheme
    if (!['file', ContentProvider.schemeCurrent, ContentProvider.schemeIncoming].includes(scheme)) return
    const visibleEditors = vscode.window.visibleTextEditors
    if (visibleEditors.length !== 3 || !visibleEditors.every(e => e.document.fileName === textEditor.document.fileName)) return

    const revealRange = new vscode.Range(visibleRanges[0].start.translate(1, 0), visibleRanges[0].end.translate(1, 0))
    visibleEditors.forEach(e => e.revealRange(revealRange))
  })
}

export function deactivate() { }