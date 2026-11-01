import type { ComponentType } from 'react'
import type { Win } from '../store'
import type { AppId } from './meta'
import { SystemProperties } from './SystemProperties'
import { Projects, RecycleBin } from './Explorer'
import { ProjectView } from './ProjectView'
import { Resume } from './Resume'
import { Terminal } from './Terminal'
import { Contact } from './Contact'
import { LofiPlayer } from './LofiPlayer'
import { MessageBox } from './MessageBox'
import { BreakAgent } from './BreakAgent'
import { Guard } from './Guard'

export const APP_COMPONENTS: Record<AppId, ComponentType<{ win: Win }>> = {
  computer: SystemProperties,
  projects: Projects,
  project: ProjectView,
  resume: Resume,
  terminal: Terminal,
  contact: Contact,
  music: LofiPlayer,
  recycle: RecycleBin,
  message: MessageBox,
  agent: BreakAgent,
  guard: Guard,
}
