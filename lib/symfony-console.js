/** @babel */
/* global atom */

import Path from 'path'
import FS from 'fs'
import {CompositeDisposable} from 'atom'

import SymfonyProject from './symfony-project'
import SymfonyConsoleView from './symfony-console-view'

export default class SymfonyConsole
{
  constructor (options) {
    this.disposables = new CompositeDisposable()
    this.view = new SymfonyConsoleView(this.getProjects())
    this.options = options || {}
  }

  destroy () {
    this.disposables.dispose()
    this.view.destroy()
    this.view = null
  }

  // dock/pane methods

  getURI () {
		return 'symfony-console'
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

  getElement () {
    return this.view.element
  }

  // Private methods

  getProjects () {
    if (!this.projects) {
      this.projects = {}

      this.disposables.add(atom.project.onDidChangePaths(projectPaths => {
        this.updateProjects(projectPaths)
      }))

      this.updateProjects(atom.project.getPaths())
    }

    return this.projects
  }

  updateProjects (projectPaths) {
    let removable = Object.keys(this.projects)
    let refresh = false

    projectPaths.forEach(path => {
      ['bin/console', 'app/console'].some(file => {
        try {
          const consolePath = Path.join(path, file)
          const stat = FS.statSync(consolePath)
          const index = removable.indexOf(path)

          if (stat.isFile()) {
            if (index < 0) {
              this.projects[path] = new SymfonyProject(path, file, this.options)
              refresh = true
            } else {
              removable.splice(index, 1)
            }
          }
        } catch (_) {
          // doesn't exist
        }
      })
    })

    removable.forEach(path => {
      this.projects[path].destroy()
      delete this.projects[path]
      refresh = true
    })

    if (this.view && refresh) {
      this.view.update(this.projects)
    }
  }
}
