/** @babel */
/* global Promise console process __dirname */

import {CompositeDisposable, BufferedProcess} from 'atom'
import {spawn} from 'node-pty'
import Path from 'path'

import SymfonyCommandListView from './symfony-command-list-view'

export default class SymfonyProject
{
  constructor (path, bin, options) {
    this.listeners = new CompositeDisposable()
    this.root = path
    this.bin = Path.join(path, bin)
    this.options = options || {}
    this.name = Path.basename(path)
    this.promiseToList = null
  }

  destroy () {
    if (this.view) {
      this.view.destroy()
      this.view = null
    }

    this.listeners.dispose()
  }

  listCommands (namesOnly) {
    const args = [this.bin, 'list', '--format=json']
    // const args = [consolePath].concat(['list', '--format=json'])

    if (!this.promiseToList) {
      this.promiseToList = new Promise((resolve, reject) => {
        let command = this.options.phpPath || 'php'
        let stdout = []
        let stderr = []

        let proc = new BufferedProcess({
          command,
          args,
          stdout: output => {
            stdout.push(output)
          },
          stderr: output => {
            stderr.push(output)
          },
          exit: code => {
            const result = {
              command: command + ' ' + args.join(' '),
              stdout: stdout.join('\n'),
              stderr: stderr.join('\n'),
              code
            }

            if (0 !== code) {
              return reject(new Error(result.stderr || `The php process exited with code ${code}`))
            }

            resolve(JSON.parse(result.stdout))
          }
        })

        proc.onWillThrowError(({error, handle}) => {
          handle()
          reject(error)
        })
      })
    }

    if (namesOnly) {
      return this.promiseToList.then((json) => {
        let names = []

        if (json) {
          json.commands.forEach(item => {
            names.push(item.name)
          })
        }

        return names
      })
    }

    return this.promiseToList
  }

  refreshCommands (namesOnly) {
    this.promiseToList = null
    return this.listCommands(namesOnly)
  }

  runCommand (command, terminal) {
    if (!Array.isArray(command)) {
      command = command.split(' ')
    }

    let args = [this.options.phpPath || 'php', this.bin].concat(command)

    if ("linux" === process.platform) {
      args.unshift(Path.resolve(__dirname, '../bin/patch'))
    }

    return this.execute(args, terminal)
  }

  updateComposer (terminal) {
    let args = ['update']

    if (this.options.composerPath) {
      args.unshift(this.options.composerPath)

      if (this.options.phpPath) {
        args.unshift(this.options.phpPath)
      }
    } else {
      args.unshift('composer')
    }

    if ("linux" === process.platform) {
      args.unshift(Path.resolve(__dirname, '../bin/patch'))
    }

    return this.execute(args, terminal)
  }

  getView () {
    if (!this.view) {
      this.view = new SymfonyCommandListView()

      this.listCommands().then(json => {
        this.view.update(json.commands)
      }).catch(error => {
        this.view.update()
        console.log(error)
      })

      this.listeners.add(this.view.on('refresh', () => {
        this.refreshCommands().then(json => {
          this.view.update(json.commands)
        }).catch(error => {
          this.view.update()
          console.log(error)
        })
      }))
    }

    return this.view
  }

  // Private methods

  execute (args, terminal) {
    return new Promise(resolve => {
      let env = process.env
      env['TERM'] = 'xterm-256color';

      this.detach(terminal, 'SIGKILL')

      this.pty = spawn(args[0], args.splice(1), {
        cols: terminal.cols,
        rows: terminal.rows,
        cwd: this.root,
        env: env,
        name: 'xterm-color',
      });

      this.attach(this.pty, terminal)

      this.pty.on('exit', (/*code, signal*/) => {
        this.detach(terminal)
        resolve()
        // pty.destroy();
        // pty = null;
        // terminal.hideCursor()
        // if (options.onExit)
          // options.onExit({code, signal})
      })
    })
	}

  attach (pty, terminal) {
    terminal.showCursor()

		this.listeners.add(terminal.on('paste', data => {
			if (pty) {
				pty.write(data);
			}
		}))

		this.listeners.add(terminal.on('data', data => {
			if (pty) {
				pty.write(data);
			}
		}))

		this.listeners.add(terminal.on('resize', geometry => {
			if (pty) {
				pty.resize(geometry.cols, geometry.rows);
			}
		}))

    this.listeners.add(terminal.on('signal', signal => {
      this.detach(terminal, signal)
    }))

    this.listeners.add(terminal.on('key', (key, event) => {
      if (pty) {
        if (event.code === 'Escape' || (event.code === 'KeyC' && event.ctrlKey)) {
          this.detach(terminal, 'SIGINT')
          terminal.focus()
        }
      }
    }))

		pty.on('data', data => {
			terminal.write(data);
		})

		pty.on('error', data => {
      terminal.write(data);
		})
  }

  detach (terminal, signal) {
    if (this.pty) {
      if (signal) {
        this.pty.kill(signal)
      }

      this.pty.destroy()
      this.pty = null
    }

    terminal.hideCursor()
    this.listeners.dispose()
  }
}
