/** @babel */
/* global atom */

import { CompositeDisposable } from 'atom'

import SymfonyStatusBarTileView from './views/symfony-status-bar-tile-view'
import SymfonyConsoleView from './views/symfony-console-view'
import SymfonyProjectManager from './project/symfony-project-manager'
import ViewObserver from './utils/view-observer'

export default {
  subscriptions: null,
  projectManager: null,
  consoleView: null,
  viewObserver: null,
  statusBarTile: null,

  /**
   * Activates the package
   */
  activate () {
    this.subscriptions = new CompositeDisposable()
    this.projectManager = new SymfonyProjectManager(this.getConfig())
    this.viewObserver = new ViewObserver()

    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'symfony-commands:toggle': () => this.toggleConsole()
    }))

    this.subscriptions.add(this.viewObserver.onChangedVisibility(visible => {
      this.statusBarTile.setActive(visible)
    }))

    this.subscriptions.add(this.viewObserver.onWillDestroy(() => {
      this.statusBarTile.setActive(false)
      this.consoleView.destroy()
      this.consoleView = null
    }))
  },

  /**
   * Deactivates the package
   *
   * @return {Promise}
   */
  async deactivate () {
    if (this.consoleView) {
      const pane = atom.workspace.paneForItem(this.consoleView)
      await pane.destroyItem(this.consoleView)
    }

    if (this.statusBarTile) {
      this.statusBarTile.destroy()
      this.statusBarTile = null
    }

    this.subscriptions.dispose()
  },

  /**
   * Adds an item to the status bar
   *
   * @param  {StatusBarService} statusBar - The status bar
   */
  consumeStatusBar (statusBar) {
    this.statusBarTile = new SymfonyStatusBarTileView(statusBar)
    this.subscriptions.add(this.statusBarTile.onDidClick(this.toggleConsole.bind(this)))
  },

  /**
   * Shows or hides the console
   */
  toggleConsole () {
    if (this.consoleView) {
      atom.workspace.toggle(this.consoleView)
    } else {
      this.consoleView = new SymfonyConsoleView(this.projectManager, this.getConfig())
      this.viewObserver.observe(this.consoleView)
      atom.workspace.open(this.consoleView)
    }
  },

  /**
   * Returns the package configuration
   */
  getConfig () {
    return {
      phpPath: atom.config.get('php-integrator-base.core.phpCommand') || 'php'
    }
  }
};
