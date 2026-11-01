import { useState } from 'react'
import { alertBox } from '../store'
import { EMAIL, GITHUB, LINKEDIN } from '../content/profile'
import { Icon } from '../shell/icons'

export function Contact() {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')

  const sendMail = () => {
    if (!body.trim()) {
      alertBox('Your message is empty. Write something nice first!', { title: 'New message', icon: 'warning' })
      return
    }
    const q = new URLSearchParams({ subject: subject || 'Hello from your portfolio', body })
    window.location.href = `mailto:${EMAIL}?${q.toString().replace(/\+/g, '%20')}`
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(EMAIL)
      alertBox(`Copied ${EMAIL} to the clipboard.`, { title: 'Contact' })
    } catch {
      alertBox(EMAIL, { title: 'My email' })
    }
  }

  return (
    <div className="window-body flush contact">
      <div className="ct-fields">
        <label>
          <span>To</span>
          <input type="text" value={`Sameer Choudhary <${EMAIL}>`} readOnly />
        </label>
        <label>
          <span>Subject</span>
          <input
            type="text"
            value={subject}
            placeholder="Hello from your portfolio"
            onChange={(e) => setSubject(e.target.value)}
          />
        </label>
      </div>
      <textarea
        className="ct-body"
        value={body}
        placeholder="Hi Sameer, …"
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="ct-actions">
        <div className="ct-links">
          <button className="icon-btn" title="Copy my email" onClick={copy}>
            📋
          </button>
          <a className="icon-btn" href={GITHUB} target="_blank" rel="noreferrer" title="GitHub">
            <Icon name="github" size={22} />
          </a>
          <a className="icon-btn" href={LINKEDIN} target="_blank" rel="noreferrer" title="LinkedIn">
            <Icon name="linkedin" size={22} />
          </a>
        </div>
        <small>Send opens your email app with this message filled in.</small>
        <button className="primary" onClick={sendMail}>
          Send
        </button>
      </div>
    </div>
  )
}
