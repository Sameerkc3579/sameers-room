// Everything personal shown in SameerOS lives here and in projects.ts.

export const GITHUB = 'https://github.com/Sameerkc3579'
export const LINKEDIN = 'https://www.linkedin.com/in/sameer-choudhary-646117235'
export const EMAIL = 'sameerkumar12choudhary@gmail.com'

export const profile = {
  name: 'Sameer Choudhary',
  role: 'AI / ML Engineer',
  location: 'Raipur, India',
  avatar: 'avatar.svg',
  bio: [
    "Hi, I'm Sameer, a third-year B.Tech student in Data Science & AI at IIIT Naya Raipur.",
    'I build LLM agents that do real work, and then I try to break them: my current project red-teams agents ' +
      'for prompt injection in Hindi, Bengali and code-mixed text, where English-tuned safety tools quietly fail.',
    'I like work that can be measured honestly: significance tests, data-leakage audits and real baselines. ' +
      "I've taken an endangered language (Kangri) past the best published translation score, and shipped " +
      'computer vision that runs live on a CPU.',
    'Off the clock I solve DSA problems: 700+ on LeetCode and Codeforces so far.',
  ],
  education: {
    school: 'International Institute of Information Technology (IIIT), Naya Raipur',
    degree: 'B.Tech in Data Science & Artificial Intelligence',
    period: 'Aug 2024 – May 2028',
    cgpa: '8.92 / 10',
  },
  coursework: {
    'AI Specialization': [
      'Machine Learning', 'Deep Learning', 'Natural Language Processing', 'Agentic AI',
      'Computer Vision', 'Reinforcement Learning', 'Representation Learning',
    ],
    'CS Core': ['Data Structures & Algorithms', 'Database Management Systems', 'Operating Systems'],
  } as Record<string, string[]>,
  skills: {
    Languages: ['Python', 'C++', 'SQL', 'Java', 'TypeScript', 'JavaScript'],
    'ML / DL': ['PyTorch', 'Hugging Face Transformers', 'scikit-learn', 'Pandas', 'NumPy', 'YOLOv8', 'OpenCV'],
    'LLMs & GenAI': [
      'LLM agents', 'RAG', 'Vector DBs', 'LoRA / PEFT', 'LangGraph', 'MCP', 'vLLM', 'AWQ quantization', 'Guardrails',
    ],
    'Backend & MLOps': [
      'FastAPI', 'WebSockets', 'Docker', 'ONNX', 'MongoDB', 'Redis', 'Git', 'Hugging Face Spaces', 'Vercel',
    ],
    Evaluation: [
      'Precision / Recall / F1', 'mAP', 'AUC', 'BLEU', 'COMET', 'Data-leakage checks', 'Significance testing',
    ],
  } as Record<string, string[]>,
  achievements: ['Solved 700+ data structures and algorithms problems on LeetCode and Codeforces'],
}
