/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode'
import CodeLensProvider from './codelensProvider'
import CommandHandler from './commandHandler'
import ContentProvider from './contentProvider'
import DocumentTracker from './documentTracker'
import * as interfaces from './interfaces'

const configurationSectionName = 'merge-conflict'

export default class ServiceWrapper implements vscode.Disposable {

  private services: vscode.Disposable[] = [];

  constructor(private context: vscode.ExtensionContext) { }

  begin() {

    const configuration = this.createExtensionConfiguration()
    const documentTracker = new DocumentTracker()

    this.services.push(
      documentTracker,
      new CommandHandler(documentTracker),
      new CodeLensProvider(documentTracker),
      new ContentProvider(this.context),
    )

    this.services.forEach((service: any) => {
      if (service.begin && service.begin instanceof Function) {
        service.begin(configuration)
      }
    })

    vscode.workspace.onDidChangeConfiguration(() => {
      this.services.forEach((service: any) => {
        if (service.configurationUpdated && service.configurationUpdated instanceof Function) {
          service.configurationUpdated(this.createExtensionConfiguration())
        }
      })
    })
  }

  createExtensionConfiguration(): interfaces.IExtensionConfiguration {
    const workspaceConfiguration = vscode.workspace.getConfiguration(configurationSectionName)
    // Disable original built-in extension.
    workspaceConfiguration.update('codeLens.enabled', false, true)
    workspaceConfiguration.update('decorators.enabled', false, true)

    const enableCodeLens = workspaceConfiguration.get('codeLens.enabled', true)
    const enableDecorations = workspaceConfiguration.get('decorators.enabled', true)

    return { enableCodeLens: true, enableDecorations: true, enableEditorOverview: true }
  }

  dispose() {
    this.services.forEach(disposable => disposable.dispose())
    this.services = []
  }
}