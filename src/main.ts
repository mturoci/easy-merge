/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode"
import ContentProvider from "./contentProvider"
import MergeConflictServices from "./services"


const calculateRange = ({ start, end }: vscode.Range): vscode.Range => new vscode.Range(new vscode.Position(start.line, 0), new vscode.Position(end.line + 1, 0))

export function activate(context: vscode.ExtensionContext) {
  // Register disposables
  const services = new MergeConflictServices(context)
  services.begin()
  context.subscriptions.push(services)

  let scrollingTask: NodeJS.Timeout
  let scrollingEditor: vscode.TextEditor | null
  const scrolledEditorsQueue: Set<vscode.TextEditor> = new Set()

  const foo = vscode.window.onDidChangeTextEditorVisibleRanges(({ textEditor, visibleRanges }) => {
    const scheme = textEditor.document.uri.scheme
    if (!['file', ContentProvider.schemeCurrent, ContentProvider.schemeIncoming].includes(scheme)) return
    const visibleEditors = vscode.window.visibleTextEditors
    if (visibleEditors.length !== 3 || !visibleEditors.every(e => e.document.fileName === textEditor.document.fileName)) return

    if (scrollingEditor !== textEditor) {
      if (scrolledEditorsQueue.has(textEditor)) {
        scrolledEditorsQueue.delete(textEditor)
        return
      }
      scrollingEditor = textEditor
    }
    if (scrollingTask) clearTimeout(scrollingTask)
    scrollingTask = setTimeout(() => {
      vscode.window.visibleTextEditors.forEach(editor => {
        if (editor !== textEditor) {
          scrolledEditorsQueue.add(editor)
          editor.revealRange(calculateRange(visibleRanges[0]), vscode.TextEditorRevealType.AtTop)
        }
      })
    }, 0)
  })
  context.subscriptions.push(foo)
}

export function deactivate() { }