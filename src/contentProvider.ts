/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode'

export default class MergeConflictContentProvider implements vscode.TextDocumentContentProvider, vscode.Disposable {

  static schemeCurrent = 'merge-conflict.conflict-current'
  static schemeIncoming = 'merge-conflict.conflict-incoming'

  constructor(private context: vscode.ExtensionContext) { }

  begin() {
    this.context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(MergeConflictContentProvider.schemeIncoming, this))
    this.context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(MergeConflictContentProvider.schemeCurrent, this))
  }

  dispose() { }

  async provideTextDocumentContent(uri: vscode.Uri): Promise<string | null> {
    try {
      const { scheme, ranges } = JSON.parse(uri.query) as { scheme: string, ranges: [{ line: number, character: number }[], { line: number, character: number }[]][] }

      // complete diff
      const document = await vscode.workspace.openTextDocument(uri.with({ scheme, query: '' }))

      // HACK: Start with an extra newline if breadcrumbs is enabled.
      let text = vscode.workspace.getConfiguration().get('breadcrumbs.enabled', true) ? '\n' : ''
      let rowPointer = 0
      ranges.forEach(([conflictRange]) => {
        const [start, end] = conflictRange
        text += '\n'.repeat(start.line - rowPointer)
        text += document.getText(new vscode.Range(start.line, start.character, end.line, end.character))
        rowPointer = end.line
      })
      text += '\n'.repeat(document.lineCount - rowPointer)

      return text
    }
    catch (ex) {
      await vscode.window.showErrorMessage('Unable to show comparison')
      return null
    }
  }
}