/** @babel */
/* global atom */

import Path from 'path'
import FS from 'fs'
import {CompositeDisposable, Emitter} from 'atom'

import SymfonyProject from './symfony-project'

export default class SymfonyConsole
{
  /**
   * Constructor
   *
   * @constructor
   * @param {Config} config - The package config options
   */
  constructor (config) {
    this.disposables = new CompositeDisposable()
    this.emitter = new Emitter()
    this.config = config
    this.projects = {}

    this.disposables.add(atom.project.onDidChangePaths(projectPaths => {
      this.updateProjects(projectPaths)
    }))

    this.updateProjects(atom.project.getPaths())
  }

  /**
   * Destructor
   */
  destroy () {
    this.disposables.dispose()
  }

  /**
   * Watches for changes to the open projects
   *
   * @param  {Function} cb - The change handler
   *
   * @return {Disposable}
   */
  observeProjects (cb) {
    cb(this.getProjects)

    return this.emitter.on('projects-changed', cb)
  }

  /**
   * Returns a single project identified by its root directory
   *
   * @param  {String} path - The root directory
   *
   * @return {SymfonyProject}
   */
  getProject (path) {
    if (!(path in this.projects)) {
      throw new Error(`A project for '${path}' cannot be found!`)
    }

    return this.projects[path]
  }

  /**
   * Returns all known projects
   *
   * @return {Array<SymfonyProject>}
   */
  getProjects () {
    return Object.assign({}, this.projects)
  }

  /**
   * Syncs the local project list with actual opened projects
   *
   * @private
   * @param  {Array<String>} projectPaths - The root directories
   */
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
              this.projects[path] = new SymfonyProject(path, file, this.config)
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

    if (refresh) {
      this.emitter.emit('projects-changed', Object.values(this.projects))
    }
  }
}
