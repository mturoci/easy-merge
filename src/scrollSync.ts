import * as vscode from 'vscode'
import ContentProvider from './contentProvider'
import Store from "./store"

export class ScrollSync implements vscode.Disposable {

  private scrollingTask: NodeJS.Timeout | null = null
  private scrollingEditor: vscode.TextEditor | null = null
  private scrolledEditorsQueue: Set<vscode.TextEditor> = new Set()
  private disposable: vscode.Disposable

  constructor() {
    this.disposable = vscode.window.onDidChangeTextEditorVisibleRanges(({ textEditor, visibleRanges }) => {
      const scheme = textEditor.document.uri.scheme
      if (!['file', ContentProvider.schemeCurrent, ContentProvider.schemeIncoming].includes(scheme)) return
      const visibleEditors = Store.getEditors()

      if (visibleEditors.length !== 3 || !visibleEditors.every(e => e?.document.fileName === textEditor.document.fileName)) return

      if (this.scrollingEditor !== textEditor) {
        if (this.scrolledEditorsQueue.has(textEditor)) {
          this.scrolledEditorsQueue.delete(textEditor)
          return
        }
        this.scrollingEditor = textEditor
      }
      if (this.scrollingTask) clearTimeout(this.scrollingTask)
      this.scrollingTask = setTimeout(() => {
        vscode.window.visibleTextEditors.forEach(editor => {
          if (editor !== textEditor) {
            this.scrolledEditorsQueue.add(editor)
            editor.revealRange(this.calculateRange(visibleRanges[0]), vscode.TextEditorRevealType.AtTop)
          }
        })
      }, 0)
    })
  }

  private calculateRange = ({ start, end }: vscode.Range): vscode.Range => new vscode.Range(new vscode.Position(start.line, 0), new vscode.Position(end.line + 1, 0))

  dispose() {
    this.disposable.dispose()
  }
}