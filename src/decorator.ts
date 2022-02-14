/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode'
import * as interfaces from './interfaces'

export default class MergeDecorator implements vscode.Disposable {

  private decorations: { [key: string]: vscode.TextEditorDecorationType } = {};
  private updating = new Map<vscode.TextEditor, boolean>();

  begin() {
    this.registerDecorationTypes()
  }

  configurationUpdated() {
    this.registerDecorationTypes()

    // TODO: Handle.
    // Re-apply the decoration
    // vscode.window.visibleTextEditors.forEach(e => {
    //   this.removeDecorations(e)
    //   this.applyDecorations(e, [])
    // })
  }

  private registerDecorationTypes() {
    // Dispose of existing decorations.
    Object.keys(this.decorations).forEach(k => this.decorations[k].dispose())
    this.decorations = {}

    this.decorations['current.content'] = vscode.window.createTextEditorDecorationType(
      this.generateBlockRenderOptions('merge.currentContentBackground', 'editorOverviewRuler.currentContentForeground')
    )
    this.decorations['incoming.content'] = vscode.window.createTextEditorDecorationType(
      this.generateBlockRenderOptions('merge.incomingContentBackground', 'editorOverviewRuler.incomingContentForeground')
    )
    this.decorations['commonAncestors.content'] = vscode.window.createTextEditorDecorationType(
      this.generateBlockRenderOptions('merge.commonContentBackground', 'editorOverviewRuler.commonContentForeground')
    )
  }

  dispose() {
    // TODO: Replace with Map<string, T>
    Object.keys(this.decorations).forEach(name => {
      this.decorations[name].dispose()
    })

    this.decorations = {}
  }

  private generateBlockRenderOptions(backgroundColor: string, overviewRulerColor: string): vscode.DecorationRenderOptions {
    return {
      backgroundColor: new vscode.ThemeColor(backgroundColor),
      isWholeLine: true,
      overviewRulerColor: new vscode.ThemeColor(overviewRulerColor),
      overviewRulerLane: vscode.OverviewRulerLane.Full
    }
  }

  public applyDecorations(editor: vscode.TextEditor, conflicts: interfaces.IDocumentMergeConflict[], type: 'incoming' | 'current') {
    // If we have a pending scan from the same origin, exit early. (Cannot use this.tracker.isPending() because decorations are per editor.)
    if (!editor || this.updating.get(editor)) return

    try {
      this.updating.set(editor, true)

      if (!conflicts.length) {
        this.removeDecorations(editor)
        return
      }

      // Store decorations keyed by the type of decoration, set decoration wants a "style" to go with it, which will match this key (see constructor);
      const matchDecorations: { [key: string]: vscode.Range[] } = {}
      const pushDecoration = (key: string, d: vscode.Range) => {
        matchDecorations[key] = matchDecorations[key] || []
        matchDecorations[key].push(d)
      }

      conflicts.forEach(conflict => {
        if (type === 'current' && !conflict.current.decoratorContent.isEmpty) {
          pushDecoration('current.content', this.adjustCurrentDecoratorRange(conflict.range))
        }
        if (type === 'incoming' && !conflict.incoming.decoratorContent.isEmpty) {
          pushDecoration('incoming.content', this.adjustCurrentDecoratorRange(conflict.range))
        }

        conflict.commonAncestors.forEach(commonAncestorsRegion => {
          if (!commonAncestorsRegion.decoratorContent.isEmpty) {
            pushDecoration('commonAncestors.content', commonAncestorsRegion.decoratorContent)
          }
        })
      })

      // For each match we've generated, apply the generated decoration with the matching decoration type to the
      // editor instance. Keys in both matches and decorations should match.
      Object.keys(matchDecorations).forEach(decorationKey => {
        let decorationType = this.decorations[decorationKey]

        if (decorationType) {
          editor.setDecorations(decorationType, matchDecorations[decorationKey])
        }
      })

    } finally {
      this.updating.delete(editor)
    }
  }

  private adjustCurrentDecoratorRange(range: vscode.Range) {
    let startOffset = 0, endOffset = -1
    if (vscode.workspace.getConfiguration().get('breadcrumbs.enabled', true)) {
      startOffset = 1
      endOffset = 0
    }
    return new vscode.Range(range.start.translate(startOffset, 0), range.end.translate(endOffset, 0))
  }

  private removeDecorations(editor: vscode.TextEditor) {
    // Remove all decorations, there might be none
    Object.keys(this.decorations).forEach(decorationKey => {

      // Race condition, while editing the settings, it's possible to
      // generate regions before the configuration has been refreshed
      let decorationType = this.decorations[decorationKey]

      if (decorationType) {
        editor.setDecorations(decorationType, [])
      }
    })
  }
}
