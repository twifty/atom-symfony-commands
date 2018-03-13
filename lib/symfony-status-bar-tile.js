/** @babel */
/** @jsx etch.dom */
/* global Promise */

import etch from 'etch'

export default class SymfonyStatusBarTile
{
  constructor (statusBar, toggle) {
    this.toggle = toggle

    etch.initialize(this)

    this.tile = statusBar.addLeftTile({
      item: this.element,
      priority: -99
    })
  }

  setActive (active) {
    if (this.tile) {
      let classes = this.refs.tile.classList
      if (active)
        classes.add('active')
      else
        classes.remove('active')
    }
  }

  destroy () {
    if (this.tile)
      this.tile.destroy()
  }

  update () {
    return Promise.resolve()
  }

  render () {
    return (
      <div ref='tile' onClick={this.toggle} className='symfony-status-bar'>
        <span className='icon icon-terminal'>Symfony</span>
      </div>
    )
  }
}
