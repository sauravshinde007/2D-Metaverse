// client/src/components/Sidebar.jsx

import { useState } from 'react'
import { useChat } from '../context/ChatContext'
import { useAuth } from '../context/AuthContext'
import WorldChat from './WorldChat'
import PrivateChatManager from './PrivateChatManager'

export default function Sidebar() {
  const { chatClient, channel, isConnecting } = useChat()
  const { logout } = useAuth()

  const [activePanel, setActivePanel] = useState(null)

  const togglePanel = (panelName) => {
    const newPanel = activePanel === panelName ? null : panelName
    setActivePanel(newPanel)

    window.dispatchEvent(
      new CustomEvent('chat-focus-change', { detail: { focused: !!newPanel } })
    )
  }

  const handleClose = () => {
    setActivePanel(null)
    window.dispatchEvent(
      new CustomEvent('chat-focus-change', { detail: { focused: false } })
    )
  }

  return (
    <>
      {/* Sidebar — SHARP box */}
      <div className="flex h-full w-16 flex-col items-center justify-between border border-zinc-800 bg-zinc-950/70 p-3 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col items-center gap-3">
          <RoundedIconButton
            active={activePanel === 'WORLD'}
            title="World Chat"
            onClick={() => togglePanel('WORLD')}
          >
            {/* World icon */}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none"
              viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </RoundedIconButton>

          <RoundedIconButton
            active={activePanel === 'PRIVATE'}
            title="Private Chats"
            onClick={() => togglePanel('PRIVATE')}
          >
            {/* Private icon */}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none"
              viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </RoundedIconButton>
        </div>

        <RoundedIconButton title="Logout" onClick={logout}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none"
            viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </RoundedIconButton>
      </div>

      {/* WORLD CHAT — ROUNDED panel */}
      {activePanel === 'WORLD' && (
        <div className="ml-4 h-full max-h-[70vh] w-[320px] max-w-sm rounded-xl border border-zinc-800 bg-zinc-950/85 shadow-2xl backdrop-blur-xl">
          <WorldChat
            chatClient={chatClient}
            channel={channel}
            isConnecting={isConnecting}
            onClose={handleClose}
          />
        </div>
      )}

      {/* PRIVATE CHAT — fullscreen overlay with ROUNDED window */}
      {activePanel === 'PRIVATE' && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-lg">
          <div className="h-[80vh] w-[90vw] max-w-5xl rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden">
            <PrivateChatManager onClose={handleClose} />
          </div>
        </div>
      )}
    </>
  )
}

/* Rounded icon button — only element that keeps rounded corners */
function RoundedIconButton({ active, title, onClick, children }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={[
        'flex h-11 w-11 items-center justify-center rounded-xl text-zinc-400 transition-all',
        'hover:text-white hover:bg-zinc-800',
        active
          ? 'bg-zinc-900 text-white ring-2 ring-[#9b99fe] shadow-lg'
          : 'bg-zinc-900/50',
      ].join(' ')}
    >
      {children}
    </button>
  )
}
