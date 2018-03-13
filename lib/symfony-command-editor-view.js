/** @babel */
/** @jsx etch.dom */
/* global document Promise */

import etch from 'etch'
import {CompositeDisposable, Disposable, TextEditor} from 'atom'
import * as fuzzaldrin from 'fuzzaldrin'


export default class SymfonyCommandEditor
{
  constructor(properties) {
    this.hints = []
    this.properties = properties
    this.hintEnabled = properties.enableHints === false || true
    this.disposables = new CompositeDisposable()

    etch.initialize(this)

    if (properties.className) {
      this.element.classList.add(properties.className)
    }

    const editorElement = this.refs.commandEditor.element
    const didLoseFocus = this.hideHints.bind(this)

    editorElement.addEventListener('blur', didLoseFocus)

    this.disposables.add(this.refs.commandEditor.onDidChange(() => { this.updateHints({project: this.properties.project })}))
    this.disposables.add(new Disposable(() => { editorElement.removeEventListener('blur', didLoseFocus) }))

    this.registerNavigationKeys()
  }

  destroy () {
    this.disposables.dispose()
  }

  update (properties) {
    this.properties = properties
    return this.updateHints({
      project: this.properties.project
    })
  }

  focus () {
    this.refs.commandEditor.element.focus()
  }

  clear () {
    this.refs.commandEditor.setText('')
    this.hideHints()
  }

  hideHints () {
    return this.updateHints({
      project: null,
      selected: null
    })
  }

  getText () {
    let text = this.hints[this.selectedHint] || ''

    if (!text && this.refs && this.refs.commandEditor)
      text = this.refs.commandEditor.getText().trim()

    return text
  }

  async setText (text) {
    await this.clear()

    if (text)
      this.refs.commandEditor.setText(text || '')
  }

  // Private methods

  registerNavigationKeys () {
    const fillSelection = (event) => {
      if (this.selectedHint != null && this.hints.length) {
        event.stopPropagation()
        event.preventDefault()
        const item = this.hints[this.selectedHint]
        return this.setText(item)
      }
    }
    const handleKey = (event) => {
      switch (event.key) {
        case 'ArrowUp':
          return this.onNavigate('prev', event)
        case 'ArrowDown':
          return this.onNavigate('next', event)
        case 'Escape':
          return this.hideHints()
        case 'Tab':
          return fillSelection(event)
      }
    }

    this.refs.commandEditor.element.addEventListener('keydown', handleKey)
    this.disposables.add(new Disposable(() => {
      this.refs.commandEditor.element.removeEventListener('keydown', handleKey)
    }))
  }

  onNavigate (direction, event) {
    if (this.hints.length) {
      let index = this.selectedHint

      switch (direction) {
        case 'prev':
          if (index != null) {
            index -= 1
            if (index < 0)
              index = null
          }
          break
        case 'first':
          index = 0
          break
        case 'next':
          if (index != null) {
            index += 1
            if (index >= this.hints.length)
              index = this.hints.length - 1
          } else {
            index = 0
          }
          break
        case 'last':
          index = this.hints.length - 1
          break
      }

      event.stopPropagation()

      if (index !== this.selectedHint) {
        this.selectedHint = index;
        etch.update(this)
      }
    }
  }

  updateHints ({project, selected}) {
    let getHints = Promise.resolve()

    if (this.hintEnabled) {
      this.query = this.refs.commandEditor.getText().trim()

      if (project) {
        getHints = project.listCommands(true).then(hints => {
          let update = false

          if (hints.length) {
            hints = this.query ? fuzzaldrin.filter(hints, this.query, {maxResults: 5}) : []
            if (hints.length === 1)
              hints = []

            if (this.hints.length !== hints.length) {
              this.hints = hints
              update = true
            } else {
              for (let i = 0; i < hints.length; ++i) {
                const hint = this.hints[i]
                if (!(hint && hint === hints[i])) {
                  this.hints = hints
                  update = true
                  break;
                }
              }
            }
          }

          return update
        })
      }

      return getHints.then(update => {
        let index = null

        if (selected != null && selected >= 0 && selected < this.hints.length) {
          index = selected
        }

        if (index !== this.selectedHint) {
          update = true
          this.selectedHint = index
        }

        if (update) {
          return etch.update(this)
        }
      })
    }

    return getHints
  }

  getSelectedHint () {
    return this.hints[this.selectedHint]
  }

  selectHint (index) {
    if (index != null && index >= 0 && index < this.hints.length) {
      this.setText(this.hints[index])
    }
  }

  render () {
    let items = []

    this.hints.forEach((item, index) => {
      items.push(<SelectableItem
        item={item}
        selected={this.getSelectedHint() === item}
        query={this.query}
        onClick={() => {this.updateHints({selected: index})}}
        onDoubleClick={() => {this.selectHint(index)}} />)
    })

    return (
      <div tabIndex='-1' style='font-size: 0.8em;'>
        <TextEditor ref='commandEditor' mini={true} />
        <ol ref='items' className='list-group'>
          {items}
        </ol>
      </div>
    )
  }
}

class SelectableItem {
  constructor (props) {
    this.element = document.createElement('li')
    this.update(props)

    const ignore = (event) => {
      event.stopPropagation()
      event.preventDefault()
    }
    const didClick = (event) => {
      ignore(event)
      this.onClick()
    }
    const didDoubleClick = (event) => {
      ignore(event)
      this.onDoubleClick()
    }

    this.element.addEventListener('mousedown', ignore)
    this.element.addEventListener('click', didClick)
    this.element.addEventListener('dblclick', didDoubleClick)

    this.disposable = new Disposable(() => {
      this.element.removeEventListener('mousedown', didClick)
      this.element.removeEventListener('click', didClick)
      this.element.removeEventListener('dblclick', didDoubleClick)
    })
  }

  destroy () {
    this.disposable.dispose()
    this.element.remove()
  }

  update ({selected, item, query, onClick, onDoubleClick}) {
    this.onClick = onClick
    this.onDoubleClick = onDoubleClick

    const span = this.buildContent(item, query)
    const old = this.element.firstChild

    if (old)
      this.element.removeChild(old)

    this.element.appendChild(span)

    if (selected) {
      this.element.classList.add('selected')
    } else {
      this.element.classList.remove('selected')
    }
  }

  buildContent (item, query) {
    const span = document.createElement('span')
    const matches = fuzzaldrin.match(item, query)

    let matchedChars = []
    let lastIndex = 0

    for (const matchIndex of matches) {
      const unmatched = item.substring(lastIndex, matchIndex)
      if (unmatched) {
        if (matchedChars.length > 0) {
          const matchSpan = document.createElement('span')
          matchSpan.classList.add('character-match')
          matchSpan.textContent = matchedChars.join('')
          span.appendChild(matchSpan)
          matchedChars = []
        }

        span.appendChild(document.createTextNode(unmatched))
      }

      matchedChars.push(item[matchIndex])
      lastIndex = matchIndex + 1
    }

    if (matchedChars.length > 0) {
      const matchSpan = document.createElement('span')
      matchSpan.classList.add('character-match')
      matchSpan.textContent = matchedChars.join('')
      span.appendChild(matchSpan)
    }

    const unmatched = item.substring(lastIndex)
    if (unmatched) {
      span.appendChild(document.createTextNode(unmatched))
    }

    return span
  }
}
