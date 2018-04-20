/** @babel */
/** @jsx etch.dom */

import etch from 'etch'
import {Emitter} from 'atom'

export default class SymfonyStatusBarTileView
{
    /**
     * Constructor
     *
     * @constructor
     * @param {Object} statusBar - The status bar service
     */
    constructor (statusBar) {
        etch.initialize(this)

        this.emitter = new Emitter()
        this.active = false
        this.tile = statusBar.addLeftTile({item: this.element, priority: -99})
    }

    /**
     * Destructor
     */
    destroy () {
        if (this.tile) {
            this.tile.destroy()
            etch.destroySync(this)
        }

        if (this.emitter) {
            this.emitter.dispose()
        }

        this.tile = null
        this.emitter = null
    }

    /**
     * Toggles the active state of the task bar entry
     *
     * @param {Boolean} active - The on off flag
     */
    setActive (active) {
        if (this.tile && this.refs && this.refs.tile) {
            const classes = this.refs.tile.classList

            this.active = active
            if (active) {
                classes.add('active')
            } else {
                classes.remove('active')
            }
        }
    }

    /**
     * Returns the current active state
     *
     * @return {Boolean}
     */
    isActive () {
        return this.active
    }

    /**
     * Registers a callback for the click event
     *
     * @param  {Function} cb - The click handler
     *
     * @return {Disposable}
     */
    onDidClick (cb) {
        return this.emitter.on('click', cb)
    }

    /**
     * Does nothing, required by etch
     *
     * @private
     */
    update () {}

    /**
     * Renders the virtual dom
     *
     * @return {VirtualDom} - Required by etch
     */
    render () {
        const onClick = () => {
            this.emitter.emit('click')
        }

        return (
            <div ref='tile' onClick={onClick} className='symfony-status-bar'>
                <span className='icon icon-terminal'>Symfony</span>
            </div>
        )
    }
}
