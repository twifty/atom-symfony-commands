/** @babel */
/* global atom ResizeObserver console */

import etch from 'etch'
import {Disposable, Emitter} from 'atom'
import Terminal from 'xterm'

Terminal.loadAddon('fit')

export default class SymfonyTerminal
{
  constructor () {
    this.terminal = new Terminal({
			rows: 40,
			cols: 80,
			scrollback: 4294967295,
			useStyle: false,
			cursorBlink: true
		})
    this.emitter = new Emitter()
    this.resizeObserver = new ResizeObserver(() => {
      this.fit()
    })
  }

  destroy () {
    this.resizeObserver.disconnect()

    if (typeof this.terminal.destry === 'function') {
      this.terminal.destroy()
    }

    this.terminal = null
  }

  attach (element) {
    const editor = atom.config.settings.editor
    if (editor) {
      if (editor.fontSize) {
        element.style.fontSize = editor.fontSize + 'px'
      }
      if (editor.fontFamily) {
        element.style.fontFamily = editor.fontFamily
      }
      if (editor.lineHeight) {
        element.style.lineHeight = editor.lineHeight
      }
    }

    // xterm 3.X can only measure char sizes when the element is in the window
    return etch.getScheduler().getNextUpdatePromise().then(() => {
      this.resizeObserver.observe(element)
      this.terminal.open(element, true)
      this.fit()
    })
  }

  fit () {
    this.terminal.fit()
  }

  // xterm wrapper methods

  focus () {
    return this.terminal.focus()
  }

  blur () {
    return this.terminal.blur()
  }

  write (text) {
    return this.terminal.write(text)
  }

  writeln (text) {
    return this.terminal.writeln(text)
  }

  clear () {
    return this.terminal.clear()
  }

  reset () {
    return this.terminal.reset()
  }

  scrollLines (n) {
    return this.terminal.scrollDisp(n)
  }

  scrollPages (n) {
    return this.terminal.scrollPages(n)
  }

  scrollToTop () {
    return this.terminal.scrollToTop()
  }

  scrollToBottom () {
    return this.terminal.scrollToBottom()
  }

  hasSelection () {
    return this.terminal.hasSelection()
  }

  getSelection () {
    return this.terminal.getSelection()
  }

  clearSelection () {
    return this.terminal.clearSelection()
  }

  selectAll () {
    return this.terminal.selectAll()
  }

  refresh (start, end, queue) {
    return this.terminal.refresh(start, end, queue)
  }

  resize (cols, rows) {
    return this.terminal.resize(cols, rows)
  }

  showCursor () {
    this.terminal.write('\u001B[?25h')
  }

  hideCursor () {
    this.terminal.write('\u001B[?25l')
  }

  on (event, cb) {
    switch (event) {
      case 'copy':
      case 'paste':
      case 'signal':
        return this.emitter.on(event, cb)

      case 'title-changed':
      case 'path-changed':
      case 'icon-changed':
      case 'modified-status-changed':
        return new Disposable(() => {})

      case 'blur':
      case 'data':
      case 'focus':
      case 'key':
      case 'keydown':
      case 'keypress':
      case 'linefeed':
      case 'open':
      case 'refresh':
      case 'resize':
      case 'scroll':
      case 'title':
        this.terminal.on(event, cb)
        return new Disposable(() => {
          this.terminal.off(event, cb)
        })
      default:
        console.error(`Event ${event} is not recognized.`)
        return false
    }
  }
}
