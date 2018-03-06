/** @babel */
/* global atom process console Promise __dirname */

import Path from 'path'
import FS from 'fs'
import {spawn} from 'node-pty'
import {CompositeDisposable, BufferedProcess} from 'atom'

var projectCache = {}

async function fetchCommands (consolePath, options) {
  if (!projectCache[consolePath] || options.refresh) {
    try {
      const result = await runListCommand(consolePath, options)
      const json = JSON.parse(result.stdout)

      projectCache[consolePath] = json

      return json
    } catch (error) {
      atom.notifications.addError('Failed to fetch commands', {
        dismissable: true,
        detail: error
      })
    }
  }

  return projectCache[consolePath]
}

function runListCommand (consolePath, options) {
  const args = [consolePath].concat(['list', '--format=json'])

  return new Promise((resolve, reject) => {
    let command = options.phpPath || 'php'
    let stdout = []
    let stderr = []
    let php = new BufferedProcess({
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
          console.log(result.stderr)
          return reject(new Error(`The php process exited with code ${code}`))
        }

        resolve(result)
      }
    })

    php.onWillThrowError(({error, handle}) => {
      handle()
      reject(error)
    })
  })
}

export default class SymfonyConsole {
  static runCommand(command, cwd, terminal, options) {
    const symfony = new SymfonyConsole(terminal)

    if (!Array.isArray(command))
      command = command.split(' ')

    return symfony.execute(command, cwd, process.env, options)
  }

  static getConsolePaths (projectPaths) {
    if (!projectPaths)
      projectPaths = atom.project.getPaths()

    let found = []
    projectPaths.forEach(project => {
      ['bin/console', 'app/console'].some(file => {
        try {
          let consolePath = Path.join(project, file)
          let Stat = FS.statSync(consolePath)
          if (Stat.isFile()) {
            found.push(consolePath)
            return true
          }
        } catch (_) {
          // doesn't exist
        }
      })
    })

    return found
  }

  static onDidChangeConsolePaths (cb) {
    return atom.project.onDidChangePaths(projectPaths => {
      cb(this.getConsolePaths(projectPaths))
    })
  }

  static getCommands = fetchCommands

  static async listCommands (consolePath, options) {
    const json = await fetchCommands(consolePath, options)
    let names = []

    if (json) {
      json.commands.forEach(item => {
        names.push(item.name)
      })
    }

    return names
  }

  constructor (terminal) {
    this.disposables = new CompositeDisposable()
    this.terminal = terminal
    this.pty = null
  }

  destroy () {
    this.disposables.dispose()
    if (this.pty) {
      this.pty.destroy()
      this.pty = null
    }
  }

  execute(command, cwd, env, options) {
		env['TERM'] = 'xterm-256color';

    let bin = options.phpPath || 'php'
    if ("linux" === process.platform) {
      bin = Path.resolve(__dirname, '../bin/patch')
    }

		// this.pty = spawn(command[0], command.slice(1), {
		this.pty = spawn(bin, command, {
			cols: this.terminal.cols,
			rows: this.terminal.rows,
			cwd: cwd,
			env: env,
			name: 'xterm-color',
		});

		this.disposables.add(this.terminal.on('paste', data => {
			if (this.pty) {
				this.pty.write(data);
			}
		}))

		this.disposables.add(this.terminal.on('data', data => {
			if (this.pty) {
				this.pty.write(data);
			}
		}))

		this.disposables.add(this.terminal.on('resize', geometry => {
			if (this.pty) {
				this.pty.resize(geometry.cols, geometry.rows);
			}
		}))

    this.disposables.add(this.terminal.on('signal', signal => {
      if (this.pty) {
        this.pty.kill(signal)
        this.terminal.hideCursor()
      }
    }))

    this.disposables.add(this.terminal.on('key', (key, event) => {
      if (this.pty && event.code === 'Escape') {
        this.pty.kill('SIGINT')
        this.terminal.hideCursor()
        this.terminal.focus()
      }
    }))

		this.pty.on('data', data => {
			this.terminal.write(data);
		});

		this.pty.on('error', data => {
      this.terminal.write(data);
		});

		this.pty.on('exit', (code, signal) => {
			this.pty.destroy();
			this.pty = null;
      this.terminal.hideCursor()
      if (options.onExit)
        options.onExit({code, signal})
		});
	}
}
