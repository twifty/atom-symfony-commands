/** @babel */
/** @jsx etch.dom */
/* global atom document console Promise */

import Path from 'path'
import etch from 'etch'
import {Emitter, CompositeDisposable, Disposable} from 'atom'
import Terminal from 'xterm'
import ResizeObserver from 'resize-observer-polyfill'
import SymfonyListCommandsView from './symfony-list-commands-view'
import SymfonyConsole from './symfony-console'
import SymfonyCommandEditor from './symfony-command-editor-view'

Terminal.loadAddon('fit');

export default class ConsoleView {
  constructor () {
    this.emitter = new Emitter()
    this.disposables = new CompositeDisposable()
    this.phpPath = atom.config.get('php-integrator-base.core.phpCommand') || 'php'

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
      'core:confirm': () => this.onEnterCommand()
    }))

    const didFocus = this.focus.bind(this)
    this.element.addEventListener('focus', didFocus)
    this.disposables.add(new Disposable(() => {
      this.element.removeEventListener('focus', didFocus)
    }))

    this.initializeTerminal()
    this.bindNavigationKeys()
    this.populateProjectChoices()
  }

  destroy () {
    if (this.consoleProperties) {
      Object.keys(this.consoleProperties).forEach(key => {
        this.consoleProperties[key].destroy()
      })
      this.consoleProperties = null
    }

    this.resizeObserver.disconnect()
    this.disposables.dispose()

    etch.destroy(this)
  }

  // dock/pane methods

  getURI () {
		return 'symfony-console';
	}

	getIconName () {
		return 'terminal';
	}

	getTitle () {
		return 'Symfony Console';
	}

	getDefaultLocation () {
		return 'bottom';
	}

  // xterm wrapper methods

  focus () {
    return this.refs.commandEditor.focus()
  }

  blur () {
    return this.terminal.blur()
  }

  write (text) {
    return this.terminal.write(text)
  }

  writeln (text) {
    return this.terminal.writeln(text)
  }

  clear () {
    return this.terminal.clear()
  }

  reset () {
    this.refs.commandEditor.focus()
    return this.terminal.reset()
  }

  scrollLines (n) {
    return this.terminal.scrollDisp(n)
  }

  scrollPages (n) {
    return this.terminal.scrollPages(n)
  }

  scrollToTop () {
    return this.terminal.scrollToTop()
  }

  scrollToBottom () {
    return this.terminal.scrollToBottom()
  }

  hasSelection () {
    return this.terminal.hasSelection()
  }

  getSelection () {
    return this.terminal.getSelection()
  }

  clearSelection () {
    return this.terminal.clearSelection()
  }

  selectAll () {
    return this.terminal.selectAll()
  }

  refresh (start, end, queue) {
    return this.terminal.refresh(start, end, queue)
  }

  resize (cols, rows) {
    return this.terminal.resize(cols, rows)
  }

  on (event, cb) {
    switch (event) {
      case 'copy':
      case 'paste':
      case 'signal':
        return this.emitter.on(event, cb)

      case 'title-changed':
      case 'path-changed':
      case 'icon-changed':
      case 'modified-status-changed':
        return new Disposable(() => {})

      case 'blur':
      case 'data':
      case 'focus':
      case 'key':
      case 'keydown':
      case 'keypress':
      case 'linefeed':
      case 'open':
      case 'refresh':
      case 'resize':
      case 'scroll':
      case 'title':
        this.terminal.on(event, cb)
        return new Disposable(() => {
          this.terminal.off(event, cb)
        })
      default:
        console.error(`Event ${event} is not recognized.`)
        return false
    }
  }

  // private methods

  initializeTerminal () {
    this.terminal = new Terminal({
			rows: 40,
			cols: 80,
			scrollback: 4294967295,
			useStyle: false,
			cursorBlink: true
		});

		const editor = atom.config.settings.editor
		if (editor) {
			if (editor.fontSize)
        this.refs.xterm.style.fontSize = editor.fontSize + 'px'
			if (editor.fontFamily)
        this.refs.xterm.style.fontFamily = editor.fontFamily
			if (editor.lineHeight)
        this.refs.xterm.style.lineHeight = editor.lineHeight
		}

		this.resizeObserver = new ResizeObserver(() => {
      this.terminal.fit()
    });

		this.resizeObserver.observe(this.refs.xterm);
		this.terminal.open(this.refs.xterm, true);
  }

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
    const consoles = this.getConsoleProperties()
    const view = consoles[this.selectedProject].getView()

    view.show()
  }

  onInputCommand (command, project) {
    if (command) {
      this.refs.commandEditor.setText(command)

      this.updateProjectChoice(project)
      this.focus()
    }
  }

  onEnterCommand (command, project) {
    if (!command)
      command = this.refs.commandEditor.getText().trim()

    if (command) {
      this.updateProjectChoice(project)

      this.commandHistory.push(command)
      this.commandHistoryIndex = this.commandHistory.length
      this.refs.commandEditor.setText('')

      const props = this.consoleProperties[this.selectedProject]

      if (props) {
        this.terminal.reset()
        this.terminal.focus()

        SymfonyConsole.runCommand(`${props.path} ${command}`, props.cwd, this, {
          onExit: () => this.refs.commandEditor.focus()
        })
      }
    }
  }

  getConsoleProperties () {
    if (!this.consoleProperties) {
      this.consoleProperties = {}

      this.disposables.add(SymfonyConsole.onDidChangeConsolePaths(consolePaths => {
        this.updateConsoleProperties(consolePaths)
        this.populateProjectChoices()
      }))

      this.updateConsoleProperties(SymfonyConsole.getConsolePaths())
    }

    return this.consoleProperties
  }

  updateConsoleProperties (consolePaths) {
    let oldKeys = Object.keys(this.consoleProperties)

    this.selectedProject = null

    consolePaths.forEach(path => {
      if (!this.consoleProperties[path]) {
        const cwd = Path.resolve(path, '../..')
        const name = Path.basename(cwd)

        let properties = {
          name,
          path,
          cwd,
          listeners: new CompositeDisposable(),
          commands: []
        }

        SymfonyConsole.listCommands(path, {
          phpPath: this.phpPath
        }).then(commands => {
          properties.commands = commands
          if (this.selectedProject === properties.path)
            this.refs.commandEditor.update({items: commands})
        })

        properties.getView = () => {
          if (!properties.view) {
            properties.view = new SymfonyListCommandsView(this.phpPath, properties.path)
            properties.listeners.add(properties.view.onDidSelectRunCommand(event => {
              this.onEnterCommand(event.command, event.path)
            }))
            properties.listeners.add(properties.view.onDidSelectCopyCommand(event => {
              this.onInputCommand(event.command, event.path)
            }))
          }
          return properties.view
        }

        properties.destroy = () => {
          if (properties.view)
            properties.view.destroy()
          properties.view = null
          properties.listeners.dispose()
        }

        this.consoleProperties[path] = properties
      }

      const index = oldKeys.indexOf(path)
      if (index >= 0) {
        oldKeys.splice(index, 1)
      }
    })

    oldKeys.forEach(key => {
      this.consoleProperties[key].destroy()
      delete this.consoleProperties[key]
    })
  }

  populateProjectChoices () {
    this.refs.selectedProject.innerHTML = ''

    const consoles = this.getConsoleProperties()
    const consoleKeys = Object.keys(consoles)

    consoleKeys.forEach(key => {
      const {name, path, commands} = consoles[key]
      const option = document.createElement('option')

      option.value = path
      option.textContent = name

      if (this.selectedProject == null || path === this.selectedProject) {
        option.selected = 'selected'
        this.selectedProject = path

        if (typeof this.refs.commandEditor === SymfonyCommandEditor)
        this.refs.commandEditor.update({items: commands})
      }

      this.refs.selectedProject.appendChild(option)
    })

    this.refs.selectedProject.style.display = consoleKeys.length > 1 ? '' : 'none'
  }


  updateProjectChoice (project) {
    if (project && project !== this.selectedProject) {
      this.selectedProject = project
      this.refs.selectedProject.value = project
    }
  }

  onSelectProject () {
    this.selectedProject = this.refs.selectedProject.value
  }

  update () {
    return Promise.resolve()
  }

  render () {
    const commands = this.selectedProject ? this.consoleProperties[this.selectedProject].commands : []

    return (
      <div className='symfony-console'>
        <div className='symfony-console-input'>
          <select ref='selectedProject' className='form-control' onChange={this.onSelectProject.bind(this)}>
          </select>
          <span>console &gt;</span>
          {/* <TextEditor ref='commandEditor' mini={true} /> */}
          <SymfonyCommandEditor ref='commandEditor' items={commands} className='symfony-console-editor' />
          <button onClick={this.onList.bind(this)} className='btn'>
            List
          </button>
        </div>
        <xterm ref='xterm' className='symfony-console-terminal' attributes={{tabindex: 0}} />
      </div>
    )
  }
}
