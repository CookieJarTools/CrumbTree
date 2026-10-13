import { useCallback, useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useStore } from '../store/store'
import { OPLOG_PEEK_HEIGHT } from '../lib/ui'

type Mood =
  | 'idle'
  | 'walk'
  | 'happy'
  | 'worried'
  | 'sneaky'
  | 'lift'
  | 'yawn'
  | 'sleep'
  | 'dizzy'
  | 'annoyed'
  | 'cheer'
  | 'tumble'
  | 'upset'

const QUIPS = [
  'psst… nice commit message',
  'I touched nothing. promise.',
  'rebase responsibly 🌱',
  'found a dangling blob 🫧',
  'the tree is looking healthy',
  'detached HEAD? sounds painful',
  'I alphabetised your branches. kidding!',
  'git gud 🌿',
  'somebody fetch me a coffee',
  'this graph is my best work'
]

/** Escalating replies to being poked repeatedly. */
const PET_REPLIES = [
  ['hehe', 'thanks!', '💚', 'more please'],
  ['that tickles', 'hehehe', 'ok that’s nice'],
  ['ok… that’s enough', 'I’m ticklish!', 'easy now'],
  ['okay OKAY!', 'I’m dizzy…', 'stop it 😵']
]

const PET_COOLDOWN_MS = 550
/** Pokes within this window count as the same pestering session. */
const PET_SESSION_MS = 5000
const SLEEP_AFTER_MS = 45000

/** Cosmetically wobble a few things in the sidebar — no state is touched. */
function wobbleSomeRefs(): void {
  const rows = [...document.querySelectorAll('.ref-row, .wt-badge, .repo-tab')]
  if (rows.length === 0) return
  const picks = rows.sort(() => Math.random() - 0.5).slice(0, Math.min(3, rows.length))
  for (const el of picks) {
    el.classList.add('friend-tilt')
    setTimeout(() => el.classList.remove('friend-tilt'), 700)
  }
}

interface Heart {
  id: number
  dx: number
  glyph: string
}

export function GitFriend() {
  // Only what the render actually needs — everything the loop checks is read live
  // from the store, so the friend doesn't re-render on unrelated app state.
  const s = useStore(
    useShallow((st) => ({
      enabled: st.gitFriend,
      hasRepo: !!st.repo,
      conflicted: !!st.mergeState?.inProgress,
      view: st.view,
      // Needed to work out where the floor is and when to get out of the way.
      drawerOpen: st.drawerOpen,
      drawerPeek: st.drawerPeek,
      oplogH: st.layout['oplogH'] ?? 240,
      busy: !!st.busy,
      dialog: !!(st.prompt || st.newRepoOpen || st.cloneOpen || st.mergeDialog || st.paletteOpen)
    }))
  )

  const [x, setX] = useState(120)
  const [facing, setFacing] = useState<1 | -1>(1)
  const [mood, setMood] = useState<Mood>('idle')
  /** Perched on the log's top edge, hauling it up. Rides up with the drawer. */
  const [lifted, setLifted] = useState(false)
  const [say, setSay] = useState<string | null>(null)
  const [hearts, setHearts] = useState<Heart[]>([])
  /** Legging it to the safe corner — moves faster than an idle stroll. */
  const [scurry, setScurry] = useState(false)

  const sayTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const openedLog = useRef(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const pupilsRef = useRef<SVGGElement>(null)
  const heartId = useRef(0)
  const petAt = useRef(0)
  const petStreak = useRef(0)
  const moodTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const parkTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Live mirrors so effects can read the current mood/position without taking
  // them as dependencies (which would tear down the mischief loop on every change).
  const moodRef = useRef<Mood>('idle')
  moodRef.current = mood
  const xRef = useRef(x)
  xRef.current = x

  const speak = useCallback((text: string, ms = 2600) => {
    setSay(text)
    if (sayTimer.current) clearTimeout(sayTimer.current)
    sayTimer.current = setTimeout(() => setSay(null), ms)
  }, [])

  /** Set a mood that automatically falls back to idle. */
  const moodFor = useCallback((m: Mood, ms: number) => {
    setMood(m)
    if (moodTimer.current) clearTimeout(moodTimer.current)
    moodTimer.current = setTimeout(() => setMood('idle'), ms)
  }, [])

  // Never butt in: no pranks while you're typing, mid-operation, or in a dialog.
  // Reads live store state rather than closed-over props so the loop below can
  // depend on nothing but `enabled`.
  const canAct = useCallback((): boolean => {
    const st = useStore.getState()
    if (
      st.busy ||
      st.prompt ||
      st.menu ||
      st.newRepoOpen ||
      st.cloneOpen ||
      st.mergeDialog ||
      st.paletteOpen ||
      !st.repo ||
      st.mergeState?.inProgress ||
      // Log's open and you're reading it — stay parked in the corner.
      (st.drawerOpen && !st.drawerPeek)
    ) {
      return false
    }
    const el = document.activeElement
    const tag = el?.tagName.toLowerCase()
    if (tag === 'input' || tag === 'textarea' || (el as HTMLElement)?.isContentEditable) return false
    return true
  }, [])

  // ---- Eyes follow the cursor ----
  // Written straight to the DOM: a mousemove-driven re-render would be wasteful.
  useEffect(() => {
    if (!s.enabled) return
    const onMove = (e: MouseEvent): void => {
      const el = rootRef.current
      const p = pupilsRef.current
      if (!el || !p) return
      const r = el.getBoundingClientRect()
      const dx = e.clientX - (r.left + r.width / 2)
      const dy = e.clientY - (r.top + r.height / 2)
      const dist = Math.hypot(dx, dy) || 1
      const reach = Math.min(1.7, dist / 45)
      p.style.transform = `translate(${(dx / dist) * reach}px, ${(dy / dist) * reach}px)`
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [s.enabled])

  // ---- Nods off when you leave it alone, wakes when you come back ----
  useEffect(() => {
    if (!s.enabled) return
    let sleepTimer: ReturnType<typeof setTimeout> | null = null
    const arm = (): void => {
      if (sleepTimer) clearTimeout(sleepTimer)
      sleepTimer = setTimeout(() => {
        if (canAct() && moodRef.current === 'idle') setMood('sleep')
      }, SLEEP_AFTER_MS)
    }
    const wake = (): void => {
      if (moodRef.current === 'sleep') {
        setMood('idle')
        speak('…oh! hello', 1800)
      }
      arm()
    }
    window.addEventListener('mousemove', wake)
    window.addEventListener('keydown', wake)
    arm()
    return () => {
      if (sleepTimer) clearTimeout(sleepTimer)
      window.removeEventListener('mousemove', wake)
      window.removeEventListener('keydown', wake)
    }
  }, [s.enabled, canAct, speak])

  // React to trouble: look worried while a merge/rebase is unresolved.
  useEffect(() => {
    if (!s.enabled) return
    if (s.conflicted) {
      setMood('worried')
      speak('conflicts! I’ll be over here…', 3200)
    } else {
      setMood('idle')
    }
  }, [s.conflicted, s.enabled, speak])

  // ---- React to how things are going ----
  // Success => cheer. Error => go red and shake it off.
  useEffect(() => {
    if (!s.enabled) return
    let lastSeen = useStore.getState().toasts.at(-1)?.id ?? 0
    return useStore.subscribe((st) => {
      const latest = st.toasts.at(-1)
      if (!latest || latest.id === lastSeen) return
      lastSeen = latest.id
      if (moodRef.current === 'lift') return
      if (latest.kind === 'success') {
        moodFor('cheer', 1800)
        speak(['nice one!', 'get in! 🎉', 'lovely', 'smooth'][Math.floor(Math.random() * 4)], 1800)
      } else if (latest.kind === 'error') {
        moodFor('upset', 2600)
        speak(['uh oh…', 'that went red', 'ouch', 'git said no'][Math.floor(Math.random() * 4)], 2400)
      }
    })
  }, [s.enabled, moodFor, speak])

  // ---- Get out of the way ----
  // The log's roof is his floor, so when it opens he stands on top of it rather
  // than in front of the terminal input. And whenever you're actually doing
  // something he legs it to a safe corner and sits quietly until you're done.
  const drawerH = s.drawerOpen ? (s.drawerPeek ? OPLOG_PEEK_HEIGHT : s.oplogH) : 0
  const floor = lifted ? OPLOG_PEEK_HEIGHT - 7 : drawerH + 2
  const needsSpace = (s.drawerOpen && !s.drawerPeek) || s.busy || s.dialog

  useEffect(() => {
    if (!s.enabled || !needsSpace) return
    // Never abandon the haul — he's holding the thing up.
    if (moodRef.current === 'lift') return
    const safeX = Math.max(60, window.innerWidth - 95)
    if (Math.abs(xRef.current - safeX) < 8) return // already tucked away

    setFacing(safeX > xRef.current ? 1 : -1)
    setScurry(true)
    setMood('walk')
    setX(safeX)
    // The reset lives on a ref, NOT in this effect's cleanup: `needsSpace` often
    // flips again within 500ms (busy clears the moment a repo finishes opening),
    // and a cleanup would cancel the reset and strand him running on the spot.
    if (parkTimer.current) clearTimeout(parkTimer.current)
    parkTimer.current = setTimeout(() => {
      setScurry(false)
      setMood('idle')
      setFacing(-1) // turn back to face the app once he's parked
    }, 500)
  }, [needsSpace, s.enabled])

  // ---- Take a tumble when you switch pages ----
  // Skipped on first render so he doesn't fall over the moment the app opens.
  const firstView = useRef(true)
  useEffect(() => {
    if (!s.enabled) return
    if (firstView.current) {
      firstView.current = false
      return
    }
    // Don't yank him out of something more important.
    if (moodRef.current === 'lift' || moodRef.current === 'worried') return
    moodFor('tumble', 1100)
    if (Math.random() < 0.35) speak(['woah!', 'oi!', '*thud*', 'warn me next time'][Math.floor(Math.random() * 4)], 1400)
  }, [s.view, s.enabled, moodFor, speak])

  // The mischief loop. It must depend on `enabled` ALONE: if mood/x/drawerOpen were
  // deps, every action would tear the effect down and cancel its own follow-up
  // timers, leaving the friend stuck mid-prank with the log wedged open.
  useEffect(() => {
    if (!s.enabled) return
    let alive = true
    let timer: ReturnType<typeof setTimeout> | null = null
    const pending: ReturnType<typeof setTimeout>[] = []
    const later = (fn: () => void, ms: number): void => {
      pending.push(setTimeout(() => alive && fn(), ms))
    }

    const act = (): void => {
      // Don't interrupt a reaction that's already playing out.
      const busyMood: Mood[] = ['worried', 'lift', 'sleep', 'dizzy', 'annoyed', 'tumble', 'upset']
      if (!canAct() || busyMood.includes(moodRef.current)) return
      const roll = Math.random()

      if (roll < 0.3) {
        // Wander somewhere else along the bottom.
        const max = Math.max(80, window.innerWidth - 300)
        const next = 60 + Math.random() * max
        setFacing(next > xRef.current ? 1 : -1)
        setMood('walk')
        setX(next)
        later(() => setMood('idle'), 1500)
      } else if (roll < 0.5) {
        speak(QUIPS[Math.floor(Math.random() * QUIPS.length)])
      } else if (roll < 0.62) {
        // A big stretch and a yawn.
        setMood('yawn')
        speak('*yaaawn*', 1600)
        later(() => setMood('idle'), 1600)
      } else if (roll < 0.8) {
        // Tilt a few tags/branches. Purely a CSS wobble — no state touched.
        setMood('sneaky')
        wobbleSomeRefs()
        speak('*boop*', 1400)
        later(() => setMood('idle'), 900)
      } else if (!useStore.getState().drawerOpen) {
        // Make a show of it: run to the middle, grab the log's edge, heave it up,
        // ride it while having a nose, then let it back down.
        openedLog.current = true
        const centre = Math.max(60, window.innerWidth / 2 - 20)
        setFacing(centre > xRef.current ? 1 : -1)
        setMood('walk')
        setX(centre)

        // …arrive, brace, and haul. The drawer rises on the same curve/duration,
        // so the friend looks like it's carrying the edge up with it.
        later(() => {
          setFacing(1)
          setMood('lift')
          setLifted(true)
          useStore.getState().peekDrawer(true)
          speak('hnnnnng…', 1500)
        }, 1500)
        later(() => speak('what’s under here?', 2200), 3100)

        // Let it down.
        later(() => {
          const st = useStore.getState()
          // Only lower it if it's still just our peek — if you opened it properly
          // (or an op took it over) drawerPeek is false and we leave it alone.
          if (openedLog.current && st.drawerPeek && !st.busy) st.peekDrawer(false)
          setLifted(false)
          openedLog.current = false
        }, 5600)
        later(() => setMood('idle'), 6000)
      }
    }

    const schedule = (): void => {
      timer = setTimeout(
        () => {
          if (!alive) return
          act()
          schedule()
        },
        6000 + Math.random() * 9000
      )
    }

    schedule()
    return () => {
      alive = false
      if (timer) clearTimeout(timer)
      for (const t of pending) clearTimeout(t)
      // Don't leave the log lifted if we were mid-peek when switched off.
      setLifted(false)
      if (openedLog.current) {
        const st = useStore.getState()
        if (st.drawerPeek && !st.busy) st.peekDrawer(false)
        openedLog.current = false
      }
    }
  }, [s.enabled, canAct, speak])

  useEffect(() => {
    return () => {
      if (sayTimer.current) clearTimeout(sayTimer.current)
      if (moodTimer.current) clearTimeout(moodTimer.current)
      if (parkTimer.current) clearTimeout(parkTimer.current)
    }
  }, [])

  const popHearts = useCallback((glyphs: string[]) => {
    const batch = glyphs.map((glyph) => ({
      id: ++heartId.current,
      dx: -10 + Math.random() * 20,
      glyph
    }))
    setHearts((h) => [...h, ...batch])
    setTimeout(() => {
      const ids = new Set(batch.map((b) => b.id))
      setHearts((h) => h.filter((x) => !ids.has(x.id)))
    }, 1000)
  }, [])

  /**
   * Petting. Rate-limited so mashing the mouse can't retrigger the reaction every
   * frame, and the replies escalate the more you pester him.
   */
  const pet = useCallback((): void => {
    const now = Date.now()
    if (now - petAt.current < PET_COOLDOWN_MS) return // still enjoying the last one
    // A gap resets the pestering; otherwise the streak climbs.
    petStreak.current = now - petAt.current > PET_SESSION_MS ? 1 : petStreak.current + 1
    petAt.current = now

    // Mid-haul: don't hijack the mood, or he'd stop straining while still perched
    // on the log's edge and the choreography would fall apart.
    if (moodRef.current === 'lift') {
      speak('bit busy!', 1200)
      return
    }

    if (moodRef.current === 'sleep') {
      setMood('idle')
      speak('…five more minutes', 1800)
      return
    }

    const tier = Math.min(PET_REPLIES.length - 1, Math.floor((petStreak.current - 1) / 2))
    const lines = PET_REPLIES[tier]
    speak(lines[Math.floor(Math.random() * lines.length)], 1500)

    if (tier >= 3) {
      // Enough is enough — get dizzy, then stomp off somewhere else.
      moodFor('dizzy', 1400)
      popHearts(['💫', '💫'])
      setTimeout(() => {
        setMood('annoyed')
        const away = Math.max(60, Math.random() * Math.max(80, window.innerWidth - 300))
        setFacing(away > xRef.current ? 1 : -1)
        setX(away)
        speak('I’m working here!', 2000)
        setTimeout(() => {
          setMood('idle')
          petStreak.current = 0
        }, 1600)
      }, 1400)
      return
    }

    moodFor('happy', 1100)
    popHearts(tier === 0 ? ['💚'] : ['💚', '✨'])
  }, [moodFor, popHearts, speak])

  if (!s.enabled || !s.hasRepo) return null

  return (
    <div className="friend-layer" aria-hidden="true">
      <div
        ref={rootRef}
        className={`friend friend-${mood} ${lifted ? 'friend-lifted' : ''} ${
          scurry ? 'friend-scurry' : ''
        }`}
        style={{
          transform: `translateX(${x}px)`,
          // Stand on whatever the floor currently is: the ground, or the roof of
          // the operation log when it's open. While hauling, the -7 tucks his feet
          // onto the lip so it reads as carrying the edge, not floating above it.
          bottom: floor
        }}
      >
        {say && <div className="friend-bubble">{say}</div>}
        {mood === 'sleep' && <div className="friend-zzz">z</div>}

        {hearts.map((h) => (
          <span key={h.id} className="friend-heart" style={{ left: `calc(50% + ${h.dx}px)` }}>
            {h.glyph}
          </span>
        ))}

        <button className="friend-body" onClick={pet} title="git friend (click to pet)">
          <svg viewBox="0 0 44 46" width="40" height="42">
            {/* sprig */}
            <g className="friend-sprig">
              <path
                d="M22 10 V4"
                stroke="var(--accent)"
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M22 6 C26 3 29 4 29 4 C29 7 26 8 22 6 Z"
                fill="var(--accent)"
                opacity="0.9"
              />
              <path
                d="M22 8 C18 5 15 6 15 6 C15 9 18 10 22 8 Z"
                fill="var(--accent)"
                opacity="0.65"
              />
            </g>
            {/* body */}
            <g className="friend-torso" style={{ transform: `scaleX(${facing})`, transformOrigin: '22px 28px' }}>
              <ellipse cx="22" cy="43" rx="11" ry="2.5" fill="#000" opacity="0.35" />
              <rect
                x="7"
                y="12"
                width="30"
                height="30"
                rx="12"
                fill="url(#friendGrad)"
                stroke="var(--accent-line)"
                strokeWidth="1"
              />
              {/* eyes — outer group blinks, inner group tracks the cursor */}
              <g className="friend-eyes">
                <g ref={pupilsRef} className="friend-pupils">
                  <circle cx="17" cy="26" r="3.4" fill="#0b0f0d" />
                  <circle cx="28" cy="26" r="3.4" fill="#0b0f0d" />
                  <circle cx="18.1" cy="24.9" r="1.1" fill="#fff" opacity="0.9" />
                  <circle cx="29.1" cy="24.9" r="1.1" fill="#fff" opacity="0.9" />
                </g>
              </g>
              {/* shut eyes, for sleeping */}
              <g className="friend-eyes-shut">
                <path d="M14 26 q3 2.5 6 0" stroke="#0b0f0d" strokeWidth="1.6" fill="none" strokeLinecap="round" />
                <path d="M25 26 q3 2.5 6 0" stroke="#0b0f0d" strokeWidth="1.6" fill="none" strokeLinecap="round" />
              </g>
              {/* spinning eyes, for dizzy */}
              <g className="friend-eyes-dizzy">
                <path d="M14.5 26 a2.5 2.5 0 1 1 5 0 a2.5 2.5 0 1 1 -5 0" stroke="#0b0f0d" strokeWidth="1.4" fill="none" />
                <path d="M25.5 26 a2.5 2.5 0 1 1 5 0 a2.5 2.5 0 1 1 -5 0" stroke="#0b0f0d" strokeWidth="1.4" fill="none" />
              </g>
              {/* mouth */}
              <path className="friend-mouth" d="M19 33 Q22 36 25 33" stroke="#0b0f0d" strokeWidth="1.6" fill="none" strokeLinecap="round" />
              {/* open mouth, for yawning */}
              <ellipse className="friend-mouth-open" cx="22" cy="34" rx="3" ry="3.6" fill="#0b0f0d" />
              {/* arms — only shown while hauling the log up; they grip the lip */}
              <g className="friend-arms">
                <path
                  d="M8 27 q-5 5 -4.5 11"
                  stroke="var(--friend-top, #8b95e6)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  fill="none"
                />
                <path
                  d="M36 27 q5 5 4.5 11"
                  stroke="var(--friend-top, #8b95e6)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  fill="none"
                />
                <circle cx="3.5" cy="39" r="2.4" fill="var(--friend-top, #8b95e6)" />
                <circle cx="40.5" cy="39" r="2.4" fill="var(--friend-top, #8b95e6)" />
              </g>
              {/* strain marks */}
              <g className="friend-strain-marks">
                <path d="M6 16 l-3 -3" stroke="#e0b95a" strokeWidth="1.6" strokeLinecap="round" />
                <path d="M38 16 l3 -3" stroke="#e0b95a" strokeWidth="1.6" strokeLinecap="round" />
              </g>
              {/* feet */}
              <circle className="friend-foot foot-l" cx="16" cy="41" r="2.6" fill="var(--friend-bottom, #4f5ac4)" />
              <circle className="friend-foot foot-r" cx="28" cy="41" r="2.6" fill="var(--friend-bottom, #4f5ac4)" />
            </g>
            <defs>
              {/* Driven by CSS vars (as style, not attributes — var() only resolves
                  in CSS properties) so a mood can recolour the whole creature. */}
              <linearGradient id="friendGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" style={{ stopColor: 'var(--friend-top, #8b95e6)' }} />
                <stop offset="100%" style={{ stopColor: 'var(--friend-bottom, #4f5ac4)' }} />
              </linearGradient>
            </defs>
          </svg>
        </button>
      </div>
    </div>
  )
}
