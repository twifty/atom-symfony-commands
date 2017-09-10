# Atom symfony-commands package

Run Symfony commands from within the editor.

##### Supports:
1. Symfony 2 and Symfony 3.
1. Interactive commands (For example `generate:bundle`).
1. Multiple open projects.
1. Running commands with all flags/options.
1. Auto completetion of command name (uses `fuzzaldrin`).

The package also provides a modal window from which you can view all commands alongside the usage and help messages of each.

##### Limitations:
The Symfony project must be setup correctly in order to list or run commands. If a command cannot be run from the standard terminal, this package will also not be able to run it.

~~This package depends on `node-pty@>=0.7.0` which currently has an [issue](https://github.com/Tyriar/node-pty/issues/72) with losing data after a stream has closed. This causes some commands (for example `list`) to not output all data. The issue is currently being dealt with and this package will update its dependency as soon as it becomes available.~~

I've added a patch for the above issue which runs through process through a `bash` script. If there any problems, please open an issue.

Due to the above issue, running `clear` within the console after data has been lost will not work correctly. A sepearate issue was opened which [`xterm refuses to fix`](https://github.com/sourcelair/xterm.js/issues/943#issuecomment-327272499). For now, calling `reset` will correctly clear and reset the terminal.

##### License
Copyright (c) 2017, Owen Parry (MIT License).
