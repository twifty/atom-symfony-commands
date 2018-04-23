/** @babel */
/* global Promise process atom __dirname */

import {CompositeDisposable} from 'atom'
import {spawn} from 'child_process'
import escape from 'shell-escape'
import Path from 'path'

export default class SymfonyProject
{
    /**
     * Constructor
     *
     * @constructor
     * @param {String} path    - The root directory
     * @param {String} bin     - Relative path to binary
     * @param {Object} options - Package options
     */
    constructor (path, bin, options) {
        this.listeners = new CompositeDisposable()
        this.root = path
        this.bin = Path.join(path, bin)
        this.options = options || {}
        this.name = Path.basename(path)
        this.promiseToList = null
        this.subProcess = null
    }

    /**
     * Destructor
     */
    destroy () {
        if (this.view) {
            this.view.destroy()
            this.view = null
        }

        this.listeners.dispose()
    }

    /**
     * Fetches the command list from the project
     *
     * The commands are cached internally.
     *
     * @param  {Boolean}               namesOnly - True for a flat array of command names
     *
     * @return {Promise<Array|Object>}
     */
    listCommands (namesOnly) {
        const args = [
            this.options.phpPath || 'php',
            this.bin,
            'list',
            '--format=json'
        ]

        if (!this.promiseToList) {
            let json = ''
            const options = {
                onOutData: (data) => {
                    json += data
                }
            }

            this.promiseToList = this.execute(args, options).then(() => {
                try {
                    const meta = JSON.parse(json)

                    return meta.commands
                } catch (error) {
                    atom.notifications.addError('Failed to parse json output of "list" command', {
                        description: error.message,
                        detail: json,
                        dismissable: true,
                    })
                }

                return []
            })
        }

        if (namesOnly) {
            return this.promiseToList.then(commands => {
                return commands.map(item => {
                    return item.name
                })
            })
        }

        return this.promiseToList
    }

    /**
     * Fetches the command list from the project
     *
     * @param  {Boolean}               namesOnly - True for a flat array of command names
     *
     * @return {Promise<Array|Object>}
     */
    refreshCommands (namesOnly) {
        this.promiseToList = null

        return this.listCommands(namesOnly)
    }

    /**
     * Runs a package command
     *
     * @param  {String|Array<String>} command - The command and options to run
     * @param  {Object}               options - Callables to handle the process output
     *
     * @return {Promise}                      - Resolves when process exits
     */
    runCommand (command, options) {
        if (!Array.isArray(command)) {
            command = command.split(' ')
        }

        if (command[0] === 'composer') {
            return this.runComposer(command.slice(1), options)
        }

        let args = [
            this.options.phpPath || 'php',
            this.bin,
            ...command
        ]

        return this.execute(args, options)
    }

    /**
     * Runs a composer command
     *
     * @param  {String|Array<String>} command - The command to run
     * @param  {Object}               options - Callables to handle the process output
     *
     * @return {Promise}                      - Resolves when the process exits
     */
    runComposer (command, options) {
        if (!Array.isArray(command)) {
            command = command.split(' ')
        }

        let args = [...command]

        if (this.options.composerPath) {
            args.unshift(this.options.composerPath)

            if (this.options.phpPath) {
                args.unshift(this.options.phpPath)
            }
        } else {
            args.unshift('composer')
        }

        return this.execute(args, options)
    }

    /**
     * Runs `composer update` in the project root
     *
     * @param  {Object}       options - Callables to handle the process output
     *
     * @return {Promise}              - Resolves when process exits
     */
    updateComposer (options) {
        return this.runComposer('update', options)
    }

    /**
     * Returns the spawned process
     *
     * @return {ChildProcess|Null}
     */
    getSubProcess () {
        return this.subProcess
    }

    /**
     * Spawns a process for the given args
     *
     * @private
     * @param  {Array<String>} command - The full command and all args to run
     * @param  {Object}        options - Callables to handle the process output
     *
     * @return {Promise}               - Resolves when process exits
     */
    execute (command, options) {
        if ("linux" === process.platform) {
            command.unshift(Path.resolve(__dirname, '../../bin/patch'))
        }

        return new Promise((resolve, reject) => {
            if (options.onCmdLine) {
                options.onCmdLine(`\x1b[33m[${this.root}]$\x1b[0m ${escape(command)}`)
            }

            this.subProcess = spawn(command[0], command.splice(1), {
                cwd: this.root,
            })

            const disposables = new CompositeDisposable()

            this.subProcess.on('error', (error) => {
                this.subProcess = null
                disposables.dispose()
                reject(error)
            })

            this.subProcess.on('close', (code, signal) => {
                this.subProcess = null
                disposables.dispose()

                if (signal) {
                    return reject(signal)
                }

                resolve(code)
            })

            if (options.onOutData) {
                this.subProcess.stdout.on('data', (data) => {
                    options.onOutData(data.toString())
                })
            }

            if (options.onErrData) {
                this.subProcess.stderr.on('data', (data) => {
                    options.onErrData(data.toString())
                })
            }

            if (options.writeData) {
                const disposable = options.writeData((data) => {
                    this.subProcess.stdin.write(data)
                })
                if (disposable && typeof disposable.dispose === 'function') {
                    disposables.add(disposable)
                }
            }

            if (options.sendSignal) {
                const disposable = options.sendSignal((signal) => {
                    this.subProcess.kill(signal)
                })
                if (disposable && typeof disposable.dispose === 'function') {
                    disposables.add(disposable)
                }
            }
        })
    }
}
