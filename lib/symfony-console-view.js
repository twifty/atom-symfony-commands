/** @babel */
/** @jsx etch.dom */
/* global atom document */

import etch from 'etch'
import {Emitter, CompositeDisposable, Disposable} from 'atom'

import SymfonyCommandEditor from './symfony-command-editor-view'
import SymfonyTerminal from './symfony-terminal'

export default class ConsoleView
{
  constructor (projects) {
    this.emitter = new Emitter()
    this.disposables = new CompositeDisposable()
    // FIXME
    this.phpPath = atom.config.get('php-integrator-base.core.phpCommand') || 'php'
    this.projects = projects

    etch.initialize(this)

    const emit = (event, value) => {
      this.emitter.emit(event, value)
    }

		this.disposables.add(atom.commands.add(this.element, {
      'symfony-console:copy': () => {emit('copy', atom.clipboard.write(this.getSelection()))},
			'symfony-console:paste': () => {emit('paste', atom.clipboard.read())},
			'symfony-console:clear': this.clear.bind(this),
      'symfony-console:reset': this.reset.bind(this),
			'symfony-console:interrupt': () => {emit('signal', 'SIGINT')},
			'symfony-console:terminate': () => {emit('signal', 'SIGTERM')},
			'symfony-console:kill': () => {emit('signal', 'SIGKILL')},
		}))

    this.disposables.add(atom.commands.add(this.refs.commandEditor.element, {
      'core:confirm': () => this.enterCommand()
    }))

    const didFocus = this.focus.bind(this)
    this.element.addEventListener('focus', didFocus)
    this.disposables.add(new Disposable(() => {
      this.element.removeEventListener('focus', didFocus)
    }))

    this.bindNavigationKeys()
    this.populateProjectChoices()

    this.terminal = new SymfonyTerminal()
    this.terminal.attach(this.refs.xterm).then(() => {
      this.terminal.hideCursor()
      this.focus()
    })
  }

  destroy () {
    this.terminal.destroy()
    this.terminal = null

    this.disposables.dispose()

    etch.destroy(this)
  }

  focus () {
    return this.refs.commandEditor.focus()
  }

  clear () {
    return this.terminal.clear()
  }

  reset () {
    this.refs.commandEditor.focus()
    this.terminal.reset()
    this.terminal.hideCursor()
  }

  // private methods

  bindNavigationKeys () {
    this.commandHistory = []
    this.commandHistoryIndex = 0

    let displayCommandHistory = (index) => {
      if (this.commandHistory[index]) {
        this.refs.commandEditor.setText(this.commandHistory[index])
        this.commandHistoryIndex = index
      } else if (index >= this.commandHistory.length) {
        this.refs.commandEditor.setText('')
        this.commandHistoryIndex = this.commandHistory.length
      }
    }

    this.refs.commandEditor.element.addEventListener('keydown', event => {
      switch (event.key) {
        case 'Escape':
          this.refs.commandEditor.hideHints()
          break;

        case 'ArrowUp':
          displayCommandHistory(this.commandHistoryIndex - 1)
          break

        case 'ArrowDown':
          displayCommandHistory(this.commandHistoryIndex + 1)
          break
      }
    })
  }

  onList () {
    const project = this.getSelectedProject()

    if (project) {
      const view = project.getView()
      const listener = new CompositeDisposable()

      listener.add(view.on('run', event => {
        this.enterCommand(event.command)
        listener.dispose()
      }))

      listener.add(view.on('copy', event => {
        this.pasteCommand(event.command)
        listener.dispose()
      }))

      listener.add(view.on('cancel', () => {
        listener.dispose()
      }))

      view.show()
    }
  }

  onUpdate () {
    const project = this.getSelectedProject()

    if (project) {
      this.terminal.reset()
      this.terminal.showCursor()
      this.terminal.focus()

      project.updateComposer(this.terminal).then(() => {
        this.focus()
      })
    }
  }

  onSelectProject () {
    this.selectedProject = this.refs.selectedProject.value
  }

  pasteCommand (command) {
    if (command) {
      this.refs.commandEditor.setText(command)
      this.focus()
    }
  }

  enterCommand (command) {
    if (!command) {
      command = this.refs.commandEditor.getText().trim()
    }

    if (command) {
      this.commandHistory.push(command)
      this.commandHistoryIndex = this.commandHistory.length
      this.refs.commandEditor.setText('')

      const project = this.getSelectedProject()

      if (project) {
        this.terminal.reset()
        this.terminal.showCursor()
        this.terminal.focus()

        project.runCommand(command, this.terminal).then(() => {
          this.terminal.hideCursor()
          this.focus()
        })
      }
    }
  }

  populateProjectChoices () {
    const projectKeys = Object.keys(this.projects)

    this.refs.selectedProject.innerHTML = ''

    projectKeys.forEach(key => {
      const project = this.projects[key]
      const option = document.createElement('option')

      option.value = project.root
      option.textContent = project.name

      if (this.selectedProject == null || project.root === this.selectedProject) {
        option.selected = 'selected'
        this.selectedProject = project.root

        if (typeof this.refs.commandEditor === SymfonyCommandEditor) {
          project.listCommands().then(commands => {
            this.refs.commandEditor.update({items: commands})
          })
        }
      }

      this.refs.selectedProject.appendChild(option)
    })

    this.refs.selectedProject.style.display = projectKeys.length > 1 ? '' : 'none'
  }

  getSelectedProject () {
    if (!this.selectedProject) {
      const keys = Object.keys(this.projects)
      this.selectedProject = keys[0]
    }

    return this.projects[this.selectedProject]
  }

  update (projects) {
    this.projects = projects
    this.populateProjectChoices()

    return etch.update(this)

    // const project = this.getSelectedProject()
    // if (project) {
    //   project.listCommands(true).then(commands => {
    //
    //   })
    // }
    //
    // return Promise.resolve()
  }

  render () {
    const project = this.getSelectedProject()

    return (
      <div className='symfony-console'>
        <div className='symfony-console-input'>
          <select ref='selectedProject' className='form-control' onChange={this.onSelectProject.bind(this)}>
          </select>
          <span>console &gt;</span>
          {/* <TextEditor ref='commandEditor' mini={true} /> */}
          <SymfonyCommandEditor ref='commandEditor' project={project} className='symfony-console-editor' />
          <button onClick={this.onList.bind(this)} className='btn'>
            List
          </button>
          <button onClick={this.onUpdate.bind(this)} className='btn'>
            Update
          </button>
        </div>
        <xterm ref='xterm' className='symfony-console-terminal' attributes={{tabindex: 0}} />
      </div>
    )
  }
}
