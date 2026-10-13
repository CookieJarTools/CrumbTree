import { describe, expect, it } from 'vitest'
import { buildTodo, isNoop, shQuote, validatePlan, type RebaseStep } from './rebase-todo'

const step = (hash: string, action: RebaseStep['action'], message?: string): RebaseStep => ({
  hash,
  action,
  message
})

describe('shQuote', () => {
  it('wraps in single quotes', () => {
    expect(shQuote('hello world')).toBe("'hello world'")
  })
  it('escapes embedded single quotes', () => {
    expect(shQuote("it's")).toBe("'it'\\''s'")
  })
  it('leaves other shell metacharacters inert', () => {
    expect(shQuote('a$b`c"d;e')).toBe(`'a$b\`c"d;e'`)
  })
})

describe('buildTodo', () => {
  it('emits pick/squash/fixup/edit/drop lines in order', () => {
    const todo = buildTodo([
      step('aaa', 'pick'),
      step('bbb', 'squash'),
      step('ccc', 'fixup'),
      step('ddd', 'edit'),
      step('eee', 'drop')
    ])
    expect(todo).toBe('pick aaa\nsquash bbb\nfixup ccc\nedit ddd\ndrop eee\n')
  })

  it('expresses reword as pick + a non-interactive amend', () => {
    const todo = buildTodo([step('aaa', 'reword', 'New subject')])
    expect(todo).toBe("pick aaa\nexec git commit --amend -m 'New subject'\n")
  })

  it('quotes reword messages safely', () => {
    const todo = buildTodo([step('aaa', 'reword', "don't $(rm -rf /) break")])
    expect(todo).toContain(`exec git commit --amend -m 'don'\\''t $(rm -rf /) break'`)
  })

  it('skips the amend when a reword message is blank', () => {
    expect(buildTodo([step('aaa', 'reword', '   ')])).toBe('pick aaa\n')
  })
})

describe('validatePlan', () => {
  it('accepts a normal plan', () => {
    expect(validatePlan([step('a', 'pick'), step('b', 'squash')])).toBeNull()
  })

  it('rejects dropping everything', () => {
    expect(validatePlan([step('a', 'drop')])).toMatch(/nothing to rebase/i)
  })

  it('rejects a leading squash or fixup', () => {
    expect(validatePlan([step('a', 'squash'), step('b', 'pick')])).toMatch(/nothing above it/i)
    expect(validatePlan([step('a', 'drop'), step('b', 'fixup')])).toMatch(/nothing above it/i)
  })

  it('requires a message for reword', () => {
    expect(validatePlan([step('a', 'reword', '')])).toMatch(/new message/i)
  })
})

describe('isNoop', () => {
  it('is true for an untouched all-pick plan', () => {
    expect(isNoop([step('a', 'pick'), step('b', 'pick')], ['a', 'b'])).toBe(true)
  })
  it('is false when reordered or edited', () => {
    expect(isNoop([step('b', 'pick'), step('a', 'pick')], ['a', 'b'])).toBe(false)
    expect(isNoop([step('a', 'pick'), step('b', 'drop')], ['a', 'b'])).toBe(false)
  })
})
