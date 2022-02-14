/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode'

export default class ContentProvider implements vscode.TextDocumentContentProvider, vscode.Disposable {

  static schemeCurrent = 'merge-conflict.conflict-current'
  static schemeIncoming = 'merge-conflict.conflict-incoming'

  constructor(private context: vscode.ExtensionContext) { }

  begin() {
    this.context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(ContentProvider.schemeIncoming, this))
    this.context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(ContentProvider.schemeCurrent, this))
  }

  dispose() { }

  async provideTextDocumentContent(uri: vscode.Uri): Promise<string | null> {
    try {
      const { ranges } = JSON.parse(uri.query) as { ranges: [{ line: number, character: number }[], { line: number, character: number }[]][] }

      const document = await vscode.workspace.openTextDocument(uri.with({ scheme: 'file', query: '' }))

      // HACK: Start with an extra newline if breadcrumbs is enabled.
      let text = vscode.workspace.getConfiguration().get('breadcrumbs.enabled', true) ? '\n\n' : ''
      let rowPointer = 0
      ranges.forEach(([conflictRange, wholeRange]) => {
        const [start, end] = conflictRange
        const [startWhole] = wholeRange
        const padding = startWhole.line - rowPointer
        text += '\n'.repeat(padding)
        text += document.getText(new vscode.Range(start.line, start.character, end.line, end.character))
        rowPointer += padding + (end.line - start.line)
      })
      text += '\n'.repeat(document.lineCount - rowPointer - 1)

      return text
    }
    catch (ex) {
      await vscode.window.showErrorMessage('Unable to show comparison')
      return null
    }
  }
}