/** @babel */
/* global atom */

import SymfonyStatusBarTile from './symfony-status-bar-tile'
import SymfonyConsoleView from './symfony-console-view'
import { CompositeDisposable } from 'atom';

export default {
  subscriptions: null,
  consoleView: null,

  activate() {
    this.isActive = true
    this.subscriptions = new CompositeDisposable()

    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'symfony-commands:toggle': () => this.toggleConsole()
    }))

    this.subscriptions.add(atom.workspace.onDidOpen(event => {
      if (event.uri === 'symfony-console' && this.statusBarTile) {
        this.statusBarTile.setActive(true)
        this.consoleView = event.item
      }
    }))

    this.subscriptions.add(atom.workspace.onWillDestroyPaneItem(event => {
      if (event.item === this.consoleView) {
        this.statusBarTile.setActive(false)
        this.consoleView = null
      }
    }))

    this.subscriptions.add(atom.workspace.onDidChangeActivePaneItem(item => {
      this.statusBarTile.setActive(this.consoleView && item === this.consoleView)
    }))
  },

  async deactivate() {
    if (this.consoleView) {
      const pane = atom.workspace.paneForItem(this.consoleView)
      await pane.destroyItem(this.consoleView)
    }

    if (this.isActive) {
      this.subscriptions.dispose()
      this.statusBarTile.destroy()
      this.statusBarTile = null
      this.isActive = false
    }
  },

  consumeStatusBar(statusBar) {
    this.statusBarTile = new SymfonyStatusBarTile(statusBar, this.toggleConsole.bind(this))
  },

  toggleConsole() {
    if (this.consoleView) {
      atom.workspace.toggle(this.consoleView)
    } else {
      atom.workspace.open(new SymfonyConsoleView())
    }
  }
};
