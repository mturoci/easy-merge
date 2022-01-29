import * as vscode from 'vscode'

class Store {

  private currentEditor: vscode.TextEditor | null = null
  private mergeEditor: vscode.TextEditor | null = null
  private incomingEditor: vscode.TextEditor | null = null

  public setEditors(currentEditor: vscode.TextEditor, mergeEditor: vscode.TextEditor, incomingEditor: vscode.TextEditor) {
    this.currentEditor = currentEditor
    this.mergeEditor = mergeEditor
    this.incomingEditor = incomingEditor
  }

  public getEditors() {
    return [this.currentEditor, this.mergeEditor, this.incomingEditor]
    // return {
    //   currentEditor: this.currentEditor,
    //   mergeEditor: this.mergeEditor,
    //   incomingEditor: this.incomingEditor,
    // }
  }
}

export default new Store()