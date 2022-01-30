/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode'
import * as interfaces from './interfaces'
import MergeDecorator from './decorator'
import ContentProvider from './contentProvider'
import store from './store'

interface IDocumentMergeConflictNavigationResults {
  canNavigate: boolean
  conflict?: interfaces.IDocumentMergeConflict
}

enum NavigationDirection {
  Forwards,
  Backwards
}

export default class CommandHandler implements vscode.Disposable {

  private disposables: vscode.Disposable[] = [];
  private tracker: interfaces.IDocumentMergeConflictTracker
  private decorator: MergeDecorator

  constructor(private context: vscode.ExtensionContext, trackerService: interfaces.IDocumentMergeConflictTrackerService) {
    this.tracker = trackerService.createTracker('commands')
    this.decorator = new MergeDecorator()
  }

  begin(config: interfaces.IExtensionConfiguration) {
    this.context.subscriptions.push(vscode.commands.registerCommand('simple-merge.diff', this.diff.bind(this)))
    this.context.subscriptions.push(vscode.commands.registerCommand('simple-merge.accept', this.accept.bind(this)))
    this.decorator.begin(config)
  }

  async diff({ resourceUri }: vscode.SourceControlResourceState) {
    const document = await vscode.workspace.openTextDocument(resourceUri)
    const conflicts = await this.tracker.getConflicts(document)

    if (!conflicts) {
      vscode.window.showWarningMessage('Editor cursor is not within a merge conflict')
      return
    }

    let ranges = conflicts.map(c => [c.current.content, c.range])
    const leftUri = document.uri.with({ scheme: ContentProvider.schemeCurrent, query: JSON.stringify({ ranges }) })

    ranges = conflicts.map(c => [c.incoming.content, c.range])
    const rightUri = leftUri.with({ scheme: ContentProvider.schemeIncoming, query: JSON.stringify({ ranges }) })

    await vscode.commands.executeCommand('workbench.action.closeActiveEditor')
    await vscode.commands.executeCommand('vscode.openWith', leftUri, 'default')
    await vscode.commands.executeCommand('vscode.openWith', document.uri, 'default', vscode.ViewColumn.Beside)
    await vscode.commands.executeCommand('vscode.openWith', rightUri, 'default', vscode.ViewColumn.Beside)

    const [currentEditor, mergeEditor, incomingEditor] = vscode.window.visibleTextEditors
    store.setEditors(currentEditor, mergeEditor, incomingEditor)

    this.decorator.applyDecorations(currentEditor, conflicts, 'current')
    this.decorator.applyDecorations(incomingEditor, conflicts, 'incoming')
  }

  private async accept(conflict: interfaces.IDocumentMergeConflict, commitType: interfaces.CommitType) {
    const [_, mergeEditor] = store.getEditors()
    if (mergeEditor) conflict.commitEdit(commitType, mergeEditor)
  }

  navigateNext(editor: vscode.TextEditor): Promise<void> {
    return this.navigate(editor, NavigationDirection.Forwards)
  }

  navigatePrevious(editor: vscode.TextEditor): Promise<void> {
    return this.navigate(editor, NavigationDirection.Backwards)
  }

  async acceptSelection(editor: vscode.TextEditor): Promise<void> {
    let conflict = await this.findConflictContainingSelection(editor)

    if (!conflict) {
      vscode.window.showWarningMessage('Editor cursor is not within a merge conflict')
      return
    }

    let typeToAccept: interfaces.CommitType
    let tokenAfterCurrentBlock: vscode.Range = conflict.splitter

    if (conflict.commonAncestors.length > 0) {
      tokenAfterCurrentBlock = conflict.commonAncestors[0].header
    }

    // Figure out if the cursor is in current or incoming, we do this by seeing if
    // the active position is before or after the range of the splitter or common
    // ancestors marker. We can use this trick as the previous check in
    // findConflictByActiveSelection will ensure it's within the conflict range, so
    // we don't falsely identify "current" or "incoming" if outside of a conflict range.
    if (editor.selection.active.isBefore(tokenAfterCurrentBlock.start)) {
      typeToAccept = interfaces.CommitType.Current
    }
    else if (editor.selection.active.isAfter(conflict.splitter.end)) {
      typeToAccept = interfaces.CommitType.Incoming
    }
    else if (editor.selection.active.isBefore(conflict.splitter.start)) {
      vscode.window.showWarningMessage('Editor cursor is within the common ancestors block, please move it to either the "current" or "incoming" block')
      return
    }
    else {
      vscode.window.showWarningMessage('Editor cursor is within the merge conflict splitter, please move it to either the "current" or "incoming" block')
      return
    }

    this.tracker.forget(editor.document)
    conflict.commitEdit(typeToAccept, editor)
  }

  dispose() {
    this.disposables.forEach(disposable => disposable.dispose())
    this.disposables = []
  }

  private async navigate(editor: vscode.TextEditor, direction: NavigationDirection): Promise<void> {
    let navigationResult = await this.findConflictForNavigation(editor, direction)

    if (!navigationResult) {
      // Check for autoNavigateNextConflict, if it's enabled(which indicating no conflict remain), then do not show warning
      const mergeConflictConfig = vscode.workspace.getConfiguration('merge-conflict')
      if (mergeConflictConfig.get<boolean>('autoNavigateNextConflict.enabled')) {
        return
      }
      vscode.window.showWarningMessage('No merge conflicts found in this file')
      return
    }
    else if (!navigationResult.canNavigate) {
      vscode.window.showWarningMessage('No other merge conflicts within this file')
      return
    }
    else if (!navigationResult.conflict) {
      // TODO: Show error message?
      return
    }

    // Move the selection to the first line of the conflict
    editor.selection = new vscode.Selection(navigationResult.conflict.range.start, navigationResult.conflict.range.start)
    editor.revealRange(navigationResult.conflict.range, vscode.TextEditorRevealType.Default)
  }

  private async findConflictContainingSelection(editor: vscode.TextEditor, conflicts?: interfaces.IDocumentMergeConflict[]): Promise<interfaces.IDocumentMergeConflict | null> {

    if (!conflicts) {
      conflicts = await this.tracker.getConflicts(editor.document)
    }

    if (!conflicts || conflicts.length === 0) {
      return null
    }

    for (const conflict of conflicts) {
      if (conflict.range.contains(editor.selection.active)) {
        return conflict
      }
    }

    return null
  }

  private async findConflictForNavigation(editor: vscode.TextEditor, direction: NavigationDirection, conflicts?: interfaces.IDocumentMergeConflict[]): Promise<IDocumentMergeConflictNavigationResults | null> {
    if (!conflicts) {
      conflicts = await this.tracker.getConflicts(editor.document)
    }

    if (!conflicts || conflicts.length === 0) {
      return null
    }

    let selection = editor.selection.active
    if (conflicts.length === 1) {
      if (conflicts[0].range.contains(selection)) {
        return {
          canNavigate: false
        }
      }

      return {
        canNavigate: true,
        conflict: conflicts[0]
      }
    }

    let predicate: (_conflict: any) => boolean
    let fallback: () => interfaces.IDocumentMergeConflict
    let scanOrder: interfaces.IDocumentMergeConflict[]

    if (direction === NavigationDirection.Forwards) {
      predicate = (conflict) => selection.isBefore(conflict.range.start)
      fallback = () => conflicts![0]
      scanOrder = conflicts
    } else if (direction === NavigationDirection.Backwards) {
      predicate = (conflict) => selection.isAfter(conflict.range.start)
      fallback = () => conflicts![conflicts!.length - 1]
      scanOrder = conflicts.slice().reverse()
    } else {
      throw new Error(`Unsupported direction ${direction}`)
    }

    for (const conflict of scanOrder) {
      if (predicate(conflict) && !conflict.range.contains(selection)) {
        return {
          canNavigate: true,
          conflict: conflict
        }
      }
    }

    // Went all the way to the end, return the head
    return {
      canNavigate: true,
      conflict: fallback()
    }
  }
}
