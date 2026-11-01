import type { IconName } from '../shell/icons'

export type AppId =
  | 'computer'
  | 'projects'
  | 'project'
  | 'resume'
  | 'terminal'
  | 'contact'
  | 'music'
  | 'recycle'
  | 'message'
  | 'agent'
  | 'guard'

export interface AppMeta {
  title: string
  icon: IconName
  w: number
  h: number
  resizable?: boolean
  /** apps that can have several windows open at once */
  multi?: boolean
}

export const APPS: Record<AppId, AppMeta> = {
  computer: { title: 'About Sameer', icon: 'computer', w: 720, h: 520 },
  projects: { title: 'Projects', icon: 'folder', w: 760, h: 480 },
  project: { title: 'Project', icon: 'folder-docs', w: 600, h: 560, multi: true },
  resume: { title: 'Resume.pdf', icon: 'pdf', w: 680, h: 600 },
  terminal: { title: 'Terminal', icon: 'cmd', w: 660, h: 420 },
  contact: { title: 'New message', icon: 'mail', w: 560, h: 480 },
  music: { title: 'Lo-fi', icon: 'music', w: 340, h: 520, resizable: false },
  recycle: { title: 'Recycle Bin', icon: 'recycle', w: 520, h: 340 },
  message: { title: 'SameerOS', icon: 'info', w: 380, h: 180, resizable: false, multi: true },
  agent: { title: 'Break my agent', icon: 'shield', w: 620, h: 560 },
  guard: { title: 'Injection detector', icon: 'scan', w: 640, h: 600 },
}
