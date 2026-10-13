import { useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useStore } from '../store/store'

export function PromptDialog() {
  const { prompt, resolvePrompt } = useStore(
    useShallow((s) => ({ prompt: s.prompt, resolvePrompt: s.resolvePrompt }))
  )
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const areaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (prompt) {
      setValue(prompt.initial ?? '')
      setTimeout(() => {
        const el = prompt.multiline ? areaRef.current : inputRef.current
        el?.focus()
        el?.select()
      }, 10)
    }
  }, [prompt])

  if (!prompt) return null

  const confirmOnly = !!prompt.confirmOnly
  const allowEmpty = !!prompt.allowEmpty
  const multiline = !!prompt.multiline
  const submit = () => {
    if (confirmOnly) return resolvePrompt('ok')
    const v = value.trim()
    if (!v && !allowEmpty) return
    resolvePrompt(v)
  }

  return (
    <div className="prompt-overlay" onClick={() => resolvePrompt(null)}>
      <div className="prompt" onClick={(e) => e.stopPropagation()}>
        <h3>{prompt.title}</h3>
        {prompt.message && <p className="prompt-message">{prompt.message}</p>}
        {prompt.label && <label className="prompt-label">{prompt.label}</label>}
        {!confirmOnly &&
          (multiline ? (
            <textarea
              ref={areaRef}
              className="prompt-textarea"
              value={value}
              placeholder={prompt.placeholder}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                // Enter inserts a newline; Ctrl/Cmd+Enter confirms.
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit()
                else if (e.key === 'Escape') resolvePrompt(null)
              }}
            />
          ) : (
            <input
              ref={inputRef}
              value={value}
              placeholder={prompt.placeholder}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit()
                else if (e.key === 'Escape') resolvePrompt(null)
              }}
            />
          ))}
        <div className="prompt-actions">
          {multiline && <span className="prompt-hint">Ctrl+Enter to save</span>}
          <button className="prompt-cancel" onClick={() => resolvePrompt(null)}>
            Cancel
          </button>
          <button
            className={`prompt-ok ${prompt.danger ? 'danger' : ''}`}
            disabled={!confirmOnly && !allowEmpty && !value.trim()}
            onClick={submit}
          >
            {prompt.confirmText ?? 'OK'}
          </button>
        </div>
      </div>
    </div>
  )
}
