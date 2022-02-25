/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode'
import * as interfaces from './interfaces'
import MergeDecorator from './decorator'
import ContentProvider from './contentProvider'
import store from './store'
import { promisify } from "util"
import { exec } from "child_process"

interface IDocumentMergeConflictNavigationResults {
  canNavigate: boolean
  conflict?: interfaces.IDocumentMergeConflict
}

enum NavigationDirection {
  Forwards,
  Backwards
}

const modalWarning = 'The file contains unresoved conflicts. Do you still want to mark merge as resolved and stage the changes?'
const promiseExec = promisify(exec)
export default class CommandHandler implements vscode.Disposable {

  private tracker: interfaces.IDocumentMergeConflictTracker
  private decorator: MergeDecorator

  constructor(private context: vscode.ExtensionContext, trackerService: interfaces.IDocumentMergeConflictTrackerService) {
    this.tracker = trackerService.createTracker('commands')
    this.decorator = new MergeDecorator()
  }

  begin() {
    this.context.subscriptions.push(vscode.commands.registerCommand('simple-merge.diff', this.diff.bind(this)))
    this.context.subscriptions.push(vscode.commands.registerCommand('simple-merge.accept', this.accept.bind(this)))
    this.context.subscriptions.push(vscode.commands.registerCommand('simple-merge.finish', this.finish.bind(this)))
    this.decorator.begin()
  }

  async diff({ resourceUri }: vscode.SourceControlResourceState) {
    const document = await vscode.workspace.openTextDocument(resourceUri)
    const conflicts = await this.tracker.getConflicts(document)

    if (!conflicts) {
      vscode.window.showWarningMessage('Editor cursor is not within a merge conflict')
      return
    }

    await vscode.commands.executeCommand('setContext', 'simple-merge.diffing', true)
    let ignoreRanges = conflicts.map(c => [c.incoming.content, c.range])
    const leftUri = document.uri.with({ scheme: ContentProvider.schemeCurrent, query: JSON.stringify({ ranges: ignoreRanges }) })

    ignoreRanges = conflicts.map(c => [c.current.content, c.range])
    const rightUri = leftUri.with({ scheme: ContentProvider.schemeIncoming, query: JSON.stringify({ ranges: ignoreRanges }) })

    await vscode.commands.executeCommand('vscode.openWith', leftUri, 'default')
    await vscode.commands.executeCommand('vscode.openWith', document.uri, 'default', vscode.ViewColumn.Beside)
    await vscode.commands.executeCommand('vscode.openWith', rightUri, 'default', vscode.ViewColumn.Beside)

    const [currentEditor, mergeEditor, incomingEditor] = vscode.window.visibleTextEditors
    store.setEditors(currentEditor, mergeEditor, incomingEditor)

    this.decorator.applyDecorations(currentEditor, conflicts, 'current')
    this.decorator.applyDecorations(incomingEditor, conflicts, 'incoming')
  }

  async finish(uri: vscode.Uri) {
    const document = await vscode.workspace.openTextDocument(uri)
    const conflicts = await this.tracker.getConflicts(document)

    if (conflicts) {
      const answer = await vscode.window.showWarningMessage(modalWarning, { modal: true }, "Yes")
      if (answer !== 'Yes') return
    }

    await promiseExec(`git add ${uri.fsPath}`, { cwd: vscode.workspace.workspaceFolders![0].uri.fsPath })
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor')
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor')
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor')
    await vscode.commands.executeCommand('setContext', 'simple-merge.diffing', false)
  }

  private async accept(conflict: interfaces.IDocumentMergeConflict, commitType: interfaces.CommitType) {
    const [_, mergeEditor] = store.getEditors()
    if (mergeEditor) conflict.commitEdit(commitType, mergeEditor)
  }

  dispose() { }

}
