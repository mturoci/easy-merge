/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode"
import * as interfaces from "./interfaces"
import ContentProvider from './contentProvider'

export default class MergeConflictCodeLensProvider implements vscode.CodeLensProvider, vscode.Disposable {
  private codeLensRegistrationHandle?: vscode.Disposable | null
  private config?: interfaces.IExtensionConfiguration
  private tracker: interfaces.IDocumentMergeConflictTracker

  constructor(trackerService: interfaces.IDocumentMergeConflictTrackerService) {
    this.tracker = trackerService.createTracker("codelens")
  }

  begin(config: interfaces.IExtensionConfiguration) {
    this.config = config
    if (this.config.enableCodeLens) this.registerCodeLensProvider()
  }

  configurationUpdated(updatedConfig: interfaces.IExtensionConfiguration) {
    if (
      updatedConfig.enableCodeLens === false &&
      this.codeLensRegistrationHandle
    ) {
      this.codeLensRegistrationHandle.dispose()
      this.codeLensRegistrationHandle = null
    } else if (
      updatedConfig.enableCodeLens === true &&
      !this.codeLensRegistrationHandle
    ) {
      this.registerCodeLensProvider()
    }

    this.config = updatedConfig
  }

  dispose() {
    if (this.codeLensRegistrationHandle) {
      this.codeLensRegistrationHandle.dispose()
      this.codeLensRegistrationHandle = null
    }
  }

  async provideCodeLenses(document: vscode.TextDocument, _token: vscode.CancellationToken): Promise<vscode.CodeLens[] | null> {
    if (!this.config || !this.config.enableCodeLens) return null

    const conflicts = await this.tracker.getConflicts(document)
    const conflictsCount = conflicts?.length ?? 0
    vscode.commands.executeCommand("setContext", "mergeConflictsCount", conflictsCount)


    const visibleEditors = vscode.window.visibleTextEditors
    if (visibleEditors.length === 3 && visibleEditors.every(e => e.document.fileName === document.fileName)) {
      const [_, conflictEditor] = visibleEditors
      const _conflicts = await this.tracker.getConflicts(conflictEditor.document)
      return _conflicts.map(c => new vscode.CodeLens(c.range, {
        command: "merge-conflict.compare-bro",
        title: document.uri.scheme === ContentProvider.schemeCurrent ? '>>' : '<<',
        arguments: [c],
      })
      )
    }

    if (!conflictsCount) return null

    // TODO: Remove.
    let items: vscode.CodeLens[] = []
    conflicts.forEach((conflict) => {
      let diffCommand: vscode.Command = {
        command: "merge-conflict.compare-bro",
        title: "Compare Changes",
        arguments: [conflict],
      }

      items.push(new vscode.CodeLens(conflict.range, diffCommand))
    })

    return items
  }

  private registerCodeLensProvider() {
    this.codeLensRegistrationHandle = vscode.languages.registerCodeLensProvider(
      [
        { scheme: "file" },
        { scheme: ContentProvider.schemeCurrent },
        { scheme: ContentProvider.schemeIncoming },
      ],
      this
    )
  }
}
