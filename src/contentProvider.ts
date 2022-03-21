import { commonAncestorsMarker, endFooterMarker, splitterMarker, startHeaderMarker } from './mergeConflictParser'
import * as vscode from 'vscode'

export default class ContentProvider implements vscode.TextDocumentContentProvider, vscode.Disposable {

  static schemeCurrent = 'merge-conflict.conflict-current'
  static schemeIncoming = 'merge-conflict.conflict-incoming'

  constructor(private context: vscode.ExtensionContext) { }

  // TODO: Remove.
  dispose() { }

  begin() {
    this.context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(ContentProvider.schemeIncoming, this))
    this.context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(ContentProvider.schemeCurrent, this))
  }

  async provideTextDocumentContent(uri: vscode.Uri): Promise<string | null> {
    try {
      const { ranges } = JSON.parse(uri.query) as { ranges: [{ line: number, character: number }[], { line: number, character: number }[]][] }
      const document = await vscode.workspace.openTextDocument(uri.with({ scheme: 'file', query: '' }))
      const invalidLines = ranges.reduce((acc, [conflict]) => {
        const [start, end] = conflict
        let _start = start.line
        for (_start; _start <= end.line; _start++) acc.add(_start)
        return acc
      }, new Set<number>())

      // HACK: Start with an extra newline if breadcrumbs enabled.
      let text = vscode.workspace.getConfiguration().get('breadcrumbs.enabled', true) ? '\n' : ''
      let newLinesCount = 1
      text += document.getText().split('\n').reduce((acc, documentLine, idx) => {
        const isGitConflict = [startHeaderMarker, commonAncestorsMarker, splitterMarker, endFooterMarker].some(l => documentLine.startsWith(l))
        if (!isGitConflict && !invalidLines.has(idx + 1)) acc.push(documentLine)
        else if (invalidLines.has(idx + 1)) newLinesCount++
        else if (documentLine.startsWith(endFooterMarker)) {
          acc.push('\n'.repeat(newLinesCount))
          newLinesCount = 1
        }
        return acc
      }, [] as string[]).join('\n')

      return text
    }
    catch (ex) {
      await vscode.window.showErrorMessage('Unable to show comparison')
      return null
    }
  }
}