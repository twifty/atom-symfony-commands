/** @babel */
/** @jsx etch.dom */
/* global Promise atom */

import etch from 'etch'
import SelectListView from 'atom-select-list'
import {Emitter, CompositeDisposable, TextEditor} from 'atom'
import CommandDescription from './symfony-command-description-view'

export default class SymfonyCommandListView
{
  constructor (commands) {
    this.emitter = new Emitter()
    this.disposables = new CompositeDisposable()
    this.commands = commands
  }

  destroy () {
    this.disposables.dispose()
    this.emitter.dispose()

    if (this.panel) {
      this.panel.destroy()
      this.panel = null
      this.commandListView.destroy()
      this.commandListView = null

      return etch.destroy(this)
    }
  }

  on (event, cb) {
    return this.emitter.on(event, cb)
  }

  toggle () {
    if (this.panel && this.panel.isVisible()) {
      this.hide()
      return Promise.resolve()
    } else {
      return this.show()
    }
  }

  show () {
    if (!this.panel)
      this.create()

    this.panel.show()
    this.commandListView.focus()
  }

  hide () {
    this.panel.hide()
  }

  // Private methods

  onConfirm (action) {
    let command = this.refs.runCommand.getText().trim()
    if (command) {
      this.hide()
      this.emitter.emit(action, {
        command
      })
    }
  }

  onRefresh () {
    this.commands = []
    this.commandListView.update({
      items: this.commands,
      loadingMessage: 'Refreshing commands...'
    })
    this.emitter.emit('refresh', {})
  }

  onCancel () {
    this.hide()
    this.emitter.emit('cancel', {})
  }

  create () {
    this.commandListView = new SelectListView({
      items: this.commands || [],
      loadingMessage: this.commands ? null : 'Loading commands...',
      filterKeyForItem: (item) => item.name,
      elementForItem: (item) => {
        return EtchElement.create(
          <li className='symfony-command-list-item'>
            <span><b>{item.name}</b></span>
            <span> --- </span>
            <p>{item.description || ''}</p>
          </li>
        )
      },
      didChangeSelection: (item) => {
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
    })

    etch.initialize(this)

    this.commandListView.element.addEventListener('keydown', event => {
      if ('Escape' == event.key) {
        event.stopPropagation()
        this.onCancel()
      } else if ('Enter' === event.key) {
        event.stopPropagation()
        this.onRun()
      }
    })

    let tabOrder = [
      this.commandListView,
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

    this.refs.selectedCommandDescription.element.style.display = 'none'
    this.panel = atom.workspace.addModalPanel({item: this})
  }

  update (commands) {
    if (!commands || !commands.length) {
      return this.commandListView.update({
        loadingMessage: null,
        errorMessage: <span className="error">No commands are available!</span>
      })
    }

    if (commands !== this.commands) {
      this.commnds = commands
      return this.commandListView.update({
        items: commands,
        loadingMessage: null
      })
    }
  }

  render () {
    let handleEnter = (event) => {
      if ('Enter' === event.key) {
        event.stopPropagation()
      }
    }

    let CommandList = () => {
      return this.commandListView
    }

    return (
      <div className='symfony-commands'>
        <div className='symfony-command-group'>
          <div className='symfony-input-item'>
            <CommandList />
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

class EtchElement {
  static create (dom) {
    let component = new EtchElement(dom)
    return component.element
  }
  constructor (dom) {
    this.dom = dom
    etch.initialize(this)
  }
  update () {
    return Promise.resolve()
  }
  render () {
    return this.dom
  }
}
