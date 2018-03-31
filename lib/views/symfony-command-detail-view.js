/** @babel */
/** @jsx etch.dom */
/* global Promise atom console */

import etch from 'etch'
import SelectListView from 'atom-select-list'
import {Emitter, CompositeDisposable, TextEditor} from 'atom'
import CommandDescription from './symfony-command-description-view'

/**
 * The view for the modal window displaying all commands and descriptions
 */
export default class SymfonyCommandDetailView
{
  /**
   * Constructor
   *
   * @constructor
   * @param {SymfonyProject} project - The project for which to display commands
   */
  constructor (project) {
    this.emitter = new Emitter()
    this.disposables = new CompositeDisposable()
    this.project = project

    etch.initialize(this)

    this.tabify()
    this.hookCoreCommands()

    this.panel = atom.workspace.addModalPanel({item: this})

    this.updateCommands()
  }

  /**
   * Configures a new project
   *
   * @param  {SymfonyProject} project - The project for which to display commands
   *
   * @return {Promise}                - Resolves when rendered
   */
  update (project) {
    if (project !== this.project) {
      this.project = project

      return this.updateCommands()
    }

    return Promise.resolve()
  }

  /**
   * Destructor
   */
  destroy () {
    this.disposables.dispose()
    this.emitter.dispose()

    if (this.panel) {
      this.panel.destroy()
      this.panel = null
    }

    return etch.destroy(this)
  }

  /**
   * Hooks one of either 'run' or 'copy' events
   *
   * @param  {String}   event - The event to hook
   * @param  {Function} cb    - The handler
   *
   * @return {Disposable}
   */
  on (event, cb) {
    return this.emitter.on(event, cb)
  }

  /**
   * Shows or hides the modal view
   *
   * @param  {Boolean} [shouldShow=true] - Flag to indicate show or hide
   */
  show (shouldShow = true) {
    if (shouldShow) {
      this.panel.show()
      this.refs.commandListView.focus()
    } else {
      this.panel.hide()
    }
  }

  /**
   * Schedules an update for the view after commands have been fetched from a project
   *
   * @private
   * @param  {Boolean} [isRefresh=false] - Refresh current project, Loading new project
   */
  updateCommands (isRefresh = false) {
    etch.getScheduler().updateDocument(async () => {
      try {
        await this.refs.commandListView.update({
          items: [],
          loadingMessage: isRefresh ? 'Refreshing commands...' : 'Loading commands...',
        })

        this.commands = await this.project.listCommands()

        if (!this.commands) {
          throw new Error("Expected the project to return an array")
        }

        if (!this.commands.length) {
          await this.refs.commandListView.update({
            loadingMessage: null,
            errorMessage: <span className="error">{ "No commands are available!" }</span>
          })
        } else {
          await this.refs.commandListView.update({
            items: this.commands,
            loadingMessage: null
          })
        }
      } catch (error) {
        console.error(error)
      }
    })
  }

  /**
   * Handles the run and copy buttons
   *
   * @private
   * @param  {String} action - Either 'run' or 'copy'
   */
  onConfirm (action) {
    let command = this.refs.runCommand.getText().trim()
    if (command) {
      this.show(false)
      this.emitter.emit(action, {
        command
      })
    }
  }

  /**
   * Handles the refresh button
   *
   * @private
   * @return {Promise}
   */
  onRefresh () {
    return this.updateCommands(true)
  }

  /**
   * Handles the cancel button, hides the modal view
   *
   * @private
   */
  onCancel () {
    this.show(false)
    this.emitter.emit('cancel', {})
  }

  /**
   * Handles the selection list change, updates current description
   *
   * @private
   * @param  {Object} item - The newly selected command item
   */
  onDidChangeSelection (item) {
    if (this.refs && this.refs.selectedCommandDescription) {
      if (item) {
        this.refs.runCommand.setText(item.name)
        this.refs.selectedCommandDescription.update({item})
      } else {
        this.refs.runCommand.setText('')
        this.refs.selectedCommandDescription.update()
      }
    }
  }

  /**
   * Adds event listeners to enable tabbing between controls
   *
   * @private
   */
  tabify () {
    let tabOrder = [
      this.refs.commandListView,
      this.refs.runCommand.element,
      this.refs.runButton,
      this.refs.copyButton,
      this.refs.refreshButton,
      this.refs.cancelButton
    ]

    let tabber = () => {
      let tabIndex = 0;
      return event => {
        if ('Tab' === event.key) {
          event.preventDefault()
          if (event.shiftKey) {
            if (--tabIndex < 0)
              tabIndex = tabOrder.length - 1
          } else if (++tabIndex >= tabOrder.length) {
            tabIndex = 0;
          }
          tabOrder[tabIndex].focus()
        }
      }
    }

    this.element.addEventListener('keydown', tabber())
  }

  /**
   * Enables keyboard and core shortcuts for accept and cancel
   *
   * @private
   */
  hookCoreCommands () {
    this.refs.commandListView.element.addEventListener('keydown', event => {
      if ('Escape' == event.key) {
        event.stopPropagation()
        this.onCancel()
      } else if ('Enter' === event.key) {
        event.stopPropagation()
        this.onRun()
      }
    })

    this.disposables.add(atom.commands.add(this.element, {
      'core:confirm': (e) => {
        this.onRun()
        e.stopPropagation()
      },
      'core:cancel': (e) => {
        this.onCancel()
        e.stopPropagation()
      }
    }))
  }

  /**
   * Creates the options required for the select list component
   *
   * @private
   * @return {Object}
   */
  generateSelectListOptions() {
    function generateListViewItem (item) {
      return etch.render( // eslint-disable-line react/no-deprecated
        <li className='symfony-command-list-item'>
          <span><b>{ item.name }</b></span>
          <span> --- </span>
          <p>{ item.description || '' }</p>
        </li>
      )
    }

    return {
      items: this.commands || [],
      loadingMessage: this.commands ? null : 'Loading commands...',
      filterKeyForItem: (item) => item.name,
      elementForItem: generateListViewItem,
      didChangeSelection: this.onDidChangeSelection.bind(this)
    }
  }

  /**
   * Renders the virtual dom
   *
   * @private
   * @return {VirtualDom} - Required by etch
   */
  render () {
    let handleEnter = (event) => {
      if ('Enter' === event.key) {
        event.stopPropagation()
      }
    }

    const selectListOptions = this.generateSelectListOptions()

    return (
      <div className='symfony-commands'>
        <div className='symfony-command-group'>
          <div className='symfony-input-item'>
            <SelectListView ref="commandListView" { ...selectListOptions } />
          </div>
        </div>

        <div className='symfony-command-group'>
          <CommandDescription ref='selectedCommandDescription' />
        </div>

        <div className='symfony-command-group'>
          <div className='symfony-input-item'>
            <TextEditor ref='runCommand' mini={true} />
          </div>
        </div>

        <div className='symfony-command-group'>
          <button ref='runButton' className='btn symfony-input-button' onClick={() => this.onConfirm('run')} onKeyDown={handleEnter}>
            Run In Terminal
          </button>
          <button ref='copyButton' className='btn symfony-input-button' onClick={() => this.onConfirm('copy')} onKeyDown={handleEnter}>
            Copy To Terminal
          </button>
          <button ref='refreshButton' className='btn symfony-input-button' onClick={() => this.onRefresh()} onKeyDown={handleEnter}>
            Refresh
          </button>
          <button ref='cancelButton' className='btn symfony-input-button' onClick={() => this.onCancel()} onKeyDown={handleEnter}>
            Cancel
          </button>
        </div>
      </div>
    )
  }
}
