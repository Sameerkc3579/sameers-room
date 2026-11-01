import { GITHUB } from './profile'

export interface Project {
  id: string
  name: string
  tagline: string
  period: string
  stack: string[]
  metric?: { value: string; label: string }
  bullets: string[]
  github: string // the project's repo (Kangri NMT has no public repo yet, so it links the profile)
  demo?: string
  team?: string
}

export const projects: Project[] = [
  {
    id: 'bhasha-shield',
    name: 'bhasha-shield',
    tagline: 'Multilingual red-teaming of LLM agents',
    period: 'Sep 2026 – Present',
    stack: ['vLLM', 'AgentDojo', 'Qwen2.5-14B', 'AWQ', 'DeBERTa', 'PromptGuard 2'],
    metric: { value: '20.5% → 6.8%', label: 'attack success after a zero-cost defense' },
    bullets: [
      'Built a harness that checks whether LLM agents can be hijacked by hidden instructions in tool outputs ' +
        '(prompt injection) in English, Hindi, Romanized Hindi, Bengali and code-mixed text, on Qwen2.5-14B ' +
        '(4-bit AWQ, served with vLLM).',
      'Benchmarked 7 defenses: a zero-cost "sandwich" prompt cut attack success from 20.5% to 6.8% ' +
        '(p = 0.004, n = 88) without hurting task completion; a DeBERTa guard cut completion from 46% to 22.7%.',
      'Found that English-tuned safety classifiers fail on Indian languages: ProtectAI flagged 47% of harmless ' +
        'Hindi tool output (2% in English); recalibrating PromptGuard 2 for Hindi raised detection from 0% to 51% at 2% FPR.',
    ],
    github: 'https://github.com/Sameerkc3579/bhasha-shield',
  },
  {
    id: 'recoverai',
    name: 'RecoverAI',
    tagline: 'LLM debt-recovery agent for small businesses',
    period: 'Apr 2026 – Jun 2026',
    stack: ['FastAPI', 'Gemini', 'MongoDB', 'Redis', 'JWT / OAuth', 'Vercel'],
    metric: { value: '90%', label: 'accuracy on Hindi/Hinglish debtor replies (vs 54% baseline)' },
    bullets: [
      'Built an LLM agent that automates invoice collection: Gemini extracts invoice data from emailed PDFs, then ' +
        'the agent runs scheduled WhatsApp/email follow-ups and drafts MSMED Act legal notices.',
      'Classified Hindi/Hinglish debtor replies (promise-to-pay, dispute, stall) to pick the next action: 90% ' +
        'accuracy on an 80-message labelled test set, vs 54% for a keyword baseline.',
      'Engineered the FastAPI + MongoDB backend with background workers, multi-model LLM fallback, JWT and ' +
        'Google OAuth login, Redis rate limiting and SSRF guards; deployed on Vercel.',
    ],
    github: 'https://github.com/Sameerkc3579/RecoverAI',
    demo: 'https://recover-ai-lyart.vercel.app',
  },
  {
    id: 'kangri-nmt',
    name: 'Kangri–Hindi NMT',
    tagline: 'Neural machine translation for an endangered language',
    period: 'Jul 2025 – Present',
    team: 'Team of 2',
    stack: ['PyTorch', 'Transformers', 'NLLB-200', 'M2M-100', 'ONNX', 'A100'],
    metric: { value: '39.14 BLEU', label: 'Kangri→Hindi (best previously reported: 28.17)' },
    bullets: [
      'Fully fine-tuned M2M-100 (418M) and NLLB-200 (600M) on 23,716 cleaned pairs for endangered Kangri, reaching ' +
        '39.14 BLEU Kangri→Hindi vs 28.17, the best previously reported (Bisht & Gupta, different test split).',
      'Showed task-specific fine-tuning beats prompting: NLLB-200 tuned on just 4,000 pairs (28.07 BLEU) ' +
        'outperformed 5-shot GPT-4o (24.32) and Llama 3.3 70B (15.19).',
      'Tested 3 meta-learning methods (FOMAML, Reptile, ANIL) on A100 GPUs; a meta-learning warm-up before ' +
        'fine-tuning added +2.0 to +3.3 BLEU, equal to doubling the training data.',
      'Wrote a TF-IDF data-leakage audit that caught a model memorising test sentences; exported models to ONNX.',
    ],
    github: GITHUB,
  },
  {
    id: 'sentinel',
    name: 'Sentinel',
    tagline: 'Real-time road accident detection',
    period: 'Jan 2026',
    stack: ['YOLOv8', 'OpenCV', 'FastAPI', 'WebSockets', 'Next.js', 'Docker'],
    metric: { value: '78.0% mAP@50', label: '84.1% precision · 69.1% recall' },
    bullets: [
      'Fine-tuned YOLOv8m on a custom accident dataset with normal-traffic negatives to cut false alarms, reaching ' +
        '84.1% precision, 69.1% recall and 78.0% mAP@50.',
      'Shipped a FastAPI + WebSocket backend and a Next.js dashboard that streams detections live and alerts only ' +
        'after 5 consecutive positive checks; runs on CPU (about 330 ms per inference) in Docker.',
    ],
    github: 'https://github.com/Sameerkc3579/accident_detection_system',
    demo: 'https://frontend-sage-ten-ufs2go2h0w.vercel.app',
  },
]

export const alsoBuilt: Project[] = [
  {
    id: 'bloggraph',
    name: 'BlogGraph',
    tagline: 'LangGraph agent that writes grounded technical blogs',
    period: '',
    stack: ['LangGraph', 'RAG', 'Web search'],
    bullets: ['A LangGraph agent that writes technical blog posts grounded in live web search (RAG).'],
    github: 'https://github.com/Sameerkc3579/BlogGraph',
  },
  {
    id: 'showyourwork',
    name: 'ShowYourWork',
    tagline: 'Tamper-evident log of AI-assisted writing',
    period: '',
    stack: ['MCP', 'Cryptographic signing', 'Testing'],
    bullets: ['An MCP server that keeps a signed, tamper-evident log of AI-assisted writing; covered by 46 tests.'],
    github: 'https://github.com/Sameerkc3579/ShowYourWork',
  },
  {
    id: 'autoelicitate',
    name: 'AutoElicitate',
    tagline: 'Auto-prepares any CSV for ML',
    period: '',
    stack: ['Python', 'Pandas', 'LLM self-repair'],
    bullets: ['Automatically prepares any CSV for machine learning; when the pipeline crashes, an LLM fixes it.'],
    github: 'https://github.com/Sameerkc3579/AutoElicitate',
  },
]

export const allProjects = [...projects, ...alsoBuilt]
