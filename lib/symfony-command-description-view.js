/** @babel */
/** @jsx etch.dom */
/* global document */

import etch from 'etch'

export default class CommandDescription {
  constructor ({item}) {
    this.setItem(item)
    etch.initialize(this)
  }

  async update ({item} = {}) {
    this.setItem(item)

    await etch.update(this)
    
    if (this.canDisplay) {
      this.element.scrollTop = 0
      this.element.style.display = ''
    } else {
      this.element.style.display = 'none'
    }
  }

  setItem (item) {
    if (item) {
      this.canDisplay = true
      this.item = item
    } else {
      this.canDisplay = false
      this.item = null
    }
  }

  render () {
    if (!this.canDisplay)
      return (<div></div>)

    let usages = []
    let args = []
    let options = []
    let help = []

    if (this.item.usage) {
      this.item.usage.forEach(use => {
        usages.push(
          <li>
            <span>{use}</span>
          </li>
        )
      })
    }

    if (this.item.definition) {
      Object.keys(this.item.definition.arguments).forEach(key => {
        const arg = this.item.definition.arguments[key]

        args.push(
          <li>
            <span><info>{arg.name}</info></span>
            <span>{arg.description}</span>
          </li>
        )
      })

      Object.keys(this.item.definition.options).forEach(key => {
        const option = this.item.definition.options[key]

        let synopsis = ''
        let defaults = ''

        if (option.shortcut)
          synopsis = option.shortcut + ', '
        synopsis += option.name
        if (option.accept_value) {
          let value = '=' + option.name.slice(2).toUpperCase()
          synopsis += option.is_value_required ? value : ('[' + value + ']')
        }

        if (option.accept_value) {
          if (Array.isArray(option.default)) {
            if (option.default.length)
              defaults = '{ ' + option.default.join(', ') + '}'
          } else if (option.default) {
            defaults = option.default
          }
        }

        let children = []
        if (defaults)
          children.push(<comment>{' [default: ' + defaults + ']'}</comment>)
        if (option.is_multiple)
          children.push(<comment>{' (multiple values allowed)'}</comment>)

        options.push(
          <li>
            <span><info>{synopsis}</info></span>
            <span>
              {option.description}
              {children}
            </span>
          </li>
        )
      })
    }

    if (this.item.help) {
      const container = document.createElement('p')
      container.innerHTML = this.item.help
      help.push(etch.dom(() => {
        return {element: container}
      }))
    }

    return (
      <div className='symfony-command-description'>
        <div className='symfony-command-description-header'>
          <span><comment>Usage:</comment></span>
          <ul>
            {usages}
          </ul>
        </div>

        <div className='symfony-command-description-header'>
          <span><comment>Arguments:</comment></span>
          <ul>
            {args}
          </ul>
        </div>

        <div className='symfony-command-description-header'>
          <span><comment>Options:</comment></span>
          <ul>
            {options}
          </ul>
        </div>

        <div className='symfony-command-description-header'>
          <span><comment>Help:</comment></span>
          <div>
            {help}
          </div>
        </div>
      </div>
    )
  }
}
