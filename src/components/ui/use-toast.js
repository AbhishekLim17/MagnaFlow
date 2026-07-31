import { useState, useEffect } from "react"

// Was 1, which meant a second toast silently erased the first. A save that
// failed for two reasons showed only the last one, and a success toast could
// wipe an error the user had not read yet.
const TOAST_LIMIT = 3

const DEFAULT_DURATION = 5000

let count = 0
function generateId() {
  count = (count + 1) % Number.MAX_VALUE
  return count.toString()
}

// Auto-dismiss is owned by the store, not by the hook.
//
// It used to live in a useEffect keyed on the toasts array inside useToast(),
// so every mounted component calling useToast() ran its own duplicate set of
// timers for the same toast. That effect also tore down and recreated every
// timer whenever the array changed, restarting the countdown of a toast
// already on screen. With the old limit of 1 that could not be seen — a new
// toast evicted the old one anyway — but raising the limit to 3 would have
// made it visible, so moving the timers here is what makes that change safe.
const timers = new Map()

function clearTimer(id) {
  const timer = timers.get(id)
  if (timer) {
    clearTimeout(timer)
    timers.delete(id)
  }
}

const toastStore = {
  state: {
    toasts: [],
  },
  listeners: [],

  getState: () => toastStore.state,

  setState: (nextState) => {
    if (typeof nextState === 'function') {
      toastStore.state = nextState(toastStore.state)
    } else {
      toastStore.state = { ...toastStore.state, ...nextState }
    }

    toastStore.listeners.forEach(listener => listener(toastStore.state))
  },

  subscribe: (listener) => {
    toastStore.listeners.push(listener)
    return () => {
      toastStore.listeners = toastStore.listeners.filter(l => l !== listener)
    }
  }
}

const removeToast = (id) => {
  clearTimer(id)
  toastStore.setState((state) => ({
    ...state,
    toasts: state.toasts.filter((t) => t.id !== id),
  }))
}

export const toast = ({ ...props }) => {
  const id = generateId()

  const update = (nextProps) =>
    toastStore.setState((state) => ({
      ...state,
      toasts: state.toasts.map((t) =>
        t.id === id ? { ...t, ...nextProps } : t
      ),
    }))

  const dismiss = () => removeToast(id)

  toastStore.setState((state) => {
    const toasts = [
      { ...props, id, dismiss },
      ...state.toasts,
    ]
    // Anything pushed past the limit is gone from the UI, so stop its timer
    // too rather than leaking a callback for a toast nobody can see.
    toasts.slice(TOAST_LIMIT).forEach((t) => clearTimer(t.id))
    return { ...state, toasts: toasts.slice(0, TOAST_LIMIT) }
  })

  if (props.duration !== Infinity) {
    timers.set(id, setTimeout(() => removeToast(id), props.duration || DEFAULT_DURATION))
  }

  return {
    id,
    dismiss,
    update,
  }
}

export function useToast() {
  const [state, setState] = useState(toastStore.getState())

  useEffect(() => toastStore.subscribe(setState), [])

  return {
    toast,
    toasts: state.toasts,
    dismiss: removeToast,
  }
}
