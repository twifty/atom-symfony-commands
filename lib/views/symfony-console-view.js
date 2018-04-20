/** @babel */
/** @jsx etch.dom */
/* global atom document */

import etch from 'etch'
import {CompositeDisposable, Disposable} from 'atom'
import {EtchTerminal} from 'colletch'

import SymfonyCommandEditorView from './symfony-command-editor-view'
import SymfonyCommandDetailView from './symfony-command-detail-view'

export default class ConsoleView
{
    /**
     * Constructor
     *
     * @constructor
     * @param {SymfonyProjectManager} projectManager - The collection of open projects
     * @param {Config}                config         - The package configuration
     */
    constructor (projectManager, config) {
        this.disposables = new CompositeDisposable()
        this.projectManager = projectManager
        this.config = config

        etch.initialize(this)

        const sendSignal = (event, value) => {
            const project = this.getSelectedProject()
            if (project) {
                const subProcess = project.getSubProcess()
                if (subProcess) {
                    subProcess.kill(value)
                }
            }
        }

        this.disposables.add(this.projectManager.observeProjects(projects => {
            this.populateProjectChoices(projects)
            etch.update(this)
        }))

        this.disposables.add(atom.commands.add(this.element, {
            'symfony-console:copy': () => {
                atom.clipboard.write(this.refs.terminal.getSelection())
            },
            'symfony-console:paste': () => {
                this.refs.terminal.pasteContent(atom.clipboard.read())
            }, // This should write to text input
            'symfony-console:clear': () => {
                this.refs.terminal.clear()
            },
            'symfony-console:reset': () => {
                this.refs.terminal.clear()
            },
            'symfony-console:interrupt': () => {
                sendSignal('signal', 'SIGINT')
            },
            'symfony-console:terminate': () => {
                sendSignal('signal', 'SIGTERM')
            },
            'symfony-console:kill': () => {
                sendSignal('signal', 'SIGKILL')
            }
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
    }

    /**
     * Destructor
     */
    destroy () {
        this.disposables.dispose()

        etch.destroy(this)
    }

    /**
     * Serializes the view
     *
     * @return {Object}
     */
    serialize () {
        return {
			deserializer: 'PhpUnitIntegratorView',
		}
    }

    /**
     * Gives focus to this view
     */
    focus () {
        return this.refs.commandEditor.focus()
    }

    /**
     * Returns the URI associated with this view
     *
     * @return {String}
     */
    getURI () {
        return 'symfony-console'
    }

    /**
     * Returns the Icon name displayed in the tab
     *
     * @return {String}
     */
    getIconName () {
        return 'terminal';
    }

    /**
     * Returns the text displayed in the tab
     *
     * @return {String}
     */
    getTitle () {
        return 'Symfony Console';
    }

    /**
     * Returns the dock where this is view is to be rendered
     *
     * @return {String}
     */
    getDefaultLocation () {
        return 'bottom';
    }

    /**
     * Returns the element for the view
     *
     * @return {DomElement}
     */
    getElement () {
        return this.element
    }

    /**
     * Creates and or returns the modal list view
     *
     * @todo It may be better to destroy rather than hide
     *
     * @private
     * @param  {SymfonyProject} project - The active project
     *
     * @return {SymfonyCommandDetailView}
     */
    getCommandDetailView (project) {
        if (!this.detailView) {
            this.detailView = new SymfonyCommandDetailView(project)

            this.disposables.add(this.detailView.on('run', event => {
                this.enterCommand(event.command)
            }))

            this.disposables.add(this.detailView.on('copy', event => {
                this.pasteCommand(event.command)
            }))
        } else {
            this.detailView.update(project)
        }

        return this.detailView
    }

    /**
     * Shows the modal list view
     *
     * @private
     */
    onDisplayDetailView () {
        const project = this.getSelectedProject()

        if (project) {
            const view = this.getCommandDetailView(project)

            view.show()
        }
    }

    /**
     * Hook the keyboard
     *
     * @private
     */
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

    /**
     * Handles the update composer button
     *
     * @private
     */
    onUpdateComposer () {
        const project = this.getSelectedProject()

        if (project) {
            const options = {
                onCmdLine: (data) => {
                    this.refs.terminal.writeln(data + '\n')
                },
                onOutData: (data) => {
                    this.refs.terminal.write(data)
                },
                onErrData: (data) => {
                    this.refs.terminal.write(data)
                }
            }

            project.updateComposer(options).then(() => {
                this.focus()
            })
        }
    }

    /**
     * Switches the active project
     *
     * @todo should also refresh commands
     * @private
     */
    onSelectProject () {
        this.selectedProject = this.refs.selectedProject.value
    }

    /**
     * Copies a command from the modal list view
     *
     * @private
     * @param  {String} command - The command and args chosen in the modal view
     */
    pasteCommand (command) {
        if (command) {
            this.refs.commandEditor.setText(command)
            this.focus()
        }
    }

    /**
     * Runs a command and renders the output
     *
     * @private
     * @param  {String} command - The command and args chosen in the modal view
     */
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
                const options = {
                    onCmdLine: (data) => {
                        this.refs.terminal.writeln(data + '\n')
                    },
                    onOutData: (data) => {
                        this.refs.terminal.write(data)
                    },
                    onErrData: (data) => {
                        this.refs.terminal.write(data)
                    },
                    writeData: (stream) => {
                        this.refs.terminal.on('input', stream)
                    },
                    sendSignal: (stream) => {
                        this.refs.terminal.on('signal', stream)
                    }
                }

                this.refs.terminal.clear()
                this.refs.commandEditor.blur()
                this.refs.terminal.focus()

                project.runCommand(command, options).then(() => {
                    this.focus()
                })
            }
        }
    }

    /**
     * Adds each project name to the choice drop down
     *
     * @private
     * @param  {Object} projects - A map of available projects
     */
    populateProjectChoices (projects) {
        const projectKeys = Object.keys(projects)

        this.refs.selectedProject.innerHTML = ''

        projectKeys.forEach(key => {
            const project = projects[key]
            const option = document.createElement('option')

            option.value = project.root
            option.textContent = project.name

            if (this.selectedProject == null || project.root === this.selectedProject) {
                option.selected = 'selected'
                this.selectedProject = project.root

                if (typeof this.refs.commandEditor === SymfonyCommandEditorView) {
                    project.listCommands().then(commands => {
                        this.refs.commandEditor.update({items: commands})
                    })
                }
            }

            this.refs.selectedProject.appendChild(option)
        })

        this.refs.selectedProject.style.display = projectKeys.length > 1
            ? ''
            : 'none'
    }

    /**
     * Returns the project for the currently selected choice
     *
     * @private
     * @return {SymfonyProject}
     */
    getSelectedProject () {
        if (!this.selectedProject) {
            const projects = this.projectManager.getProjects()
            const keys = Object.keys(projects)

            if (!keys.length) {
                return null
            }

            this.selectedProject = keys[0]
        }

        return this.projectManager.getProject(this.selectedProject)
    }

    /**
     * Does nothing
     *
     * @private
     */
    update () {}

    /**
     * Renders the virtual dom
     *
     * @private
     * @return {VirtualDom} - Required by etch
     */
    render () {
        const project = this.getSelectedProject()

        return (
            <div className='symfony-console'>
                <div className='symfony-console-input'>
                    <select ref='selectedProject' className='form-control' onChange={this.onSelectProject.bind(this)}></select>
                    <span>console &gt;</span>
                    <SymfonyCommandEditorView ref='commandEditor' project={project} className='symfony-console-editor'/>
                    <button onClick={this.onDisplayDetailView.bind(this)} className='btn'>
                        List
                    </button>
                    <button onClick={this.onUpdateComposer.bind(this)} className='btn'>
                        Update
                    </button>
                </div>
                <EtchTerminal ref="terminal"/>
            </div>
        )
    }
}
