/** @babel */
/* global atom */

import {CompositeDisposable} from 'atom'

import SymfonyStatusBarTileView from './views/symfony-status-bar-tile-view'
import SymfonyConsoleView from './views/symfony-console-view'
import SymfonyProjectManager from './project/symfony-project-manager'
import ViewObserver from './utils/view-observer'

export default class SymfonyCommands
{
    /**
     * Constructor
     *
     * @constructor
     */
    constructor () {
        this.subscriptions = new CompositeDisposable()
        this.viewObserver = new ViewObserver()
        this.projectManager = null
        this.consoleView = null
        this.statusBarTile = null
    }

    /**
     * Activates the package
     */
    activate () {
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
    }

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
    }

    /**
     * Adds an item to the status bar
     *
     * @param  {StatusBarService} statusBar - The status bar
     */
    consumeStatusBar (statusBar) {
        this.statusBarTile = new SymfonyStatusBarTileView(statusBar)
        this.subscriptions.add(this.statusBarTile.onDidClick(this.toggleConsole.bind(this)))

        this.statusBarTile.setActive(this.viewObserver.isVisible())
    }

    /**
     * Shows or hides the console
     */
    toggleConsole () {
        if (this.consoleView) {
            atom.workspace.toggle(this.consoleView)
        } else {
            atom.workspace.open(this.createView())
        }
    }

    /**
     * Creates an instance of the view
     *
     * @return {SymfonyConsoleView}
     */
    createView (state) {
        if (!this.consoleView) {
            this.consoleView = new SymfonyConsoleView(this.getProjectManager(), this.getConfig(), state)
            this.viewObserver.observe(this.consoleView)
        }

        return this.consoleView
    }

    /**
     * Returns the main project manager
     *
     * @return {SymfonyProjectManager}
     */
    getProjectManager () {
        if (!this.projectManager) {
            this.projectManager = new SymfonyProjectManager(this.getConfig())
        }

        return this.projectManager
    }

    /**
     * Returns the package configuration
     */
    getConfig () {
        return {
            phpPath: atom.config.get('php-integrator-base.core.phpCommand') || 'php'
        }
    }
}
