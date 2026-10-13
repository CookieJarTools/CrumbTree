/// <reference types="vite/client" />
import type { CrumbApi } from '../preload'

declare global {
  interface Window {
    crumb: CrumbApi
  }
}

export {}
