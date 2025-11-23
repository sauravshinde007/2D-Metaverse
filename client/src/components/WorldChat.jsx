// client/src/components/WorldChat.jsx

import { useEffect, useState, useRef } from 'react'
import {
  Chat,
  Channel,
  Window,
  MessageList,
  MessageInput,
} from 'stream-chat-react'
import 'stream-chat-react/dist/css/v2/index.css'

export default function WorldChat({ chatClient, channel, isConnecting, onClose }) {
  const chatContainerRef = useRef(null)
  const [onlineCount, setOnlineCount] = useState(0)
  const [chatFocused, setChatFocused] = useState(false)
  const chatFocusedRef = useRef(chatFocused)

  useEffect(() => {
    chatFocusedRef.current = chatFocused
  }, [chatFocused])

  // Track online presence count
  useEffect(() => {
    if (!channel) return

    const updateCount = () => {
      const members = Object.values(channel.state.members || {})
      const online = members.filter((m) => m.user?.online)
      setOnlineCount(online.length)
    }

    updateCount()
    channel.on('presence.diff', updateCount)
    return () => channel.off('presence.diff', updateCount)
  }, [channel])

  // Focus management (avoid interfering with game controls)
  useEffect(() => {
    const dispatchFocusChange = (isFocused) => {
      if (chatFocusedRef.current === isFocused) return
      setChatFocused(isFocused)
      window.dispatchEvent(
        new CustomEvent('chat-focus-change', { detail: { focused: isFocused } })
      )
    }

    const handleClickOutside = (event) => {
      if (
        chatContainerRef.current &&
        !chatContainerRef.current.contains(event.target)
      ) {
        if (chatFocusedRef.current) {
          dispatchFocusChange(false)
          const chatInput =
            chatContainerRef.current.querySelector('textarea')
          if (chatInput) chatInput.blur()
        }
      }
    }

    const handleInputFocus = (e) => {
      if (e.target.tagName === 'TEXTAREA') {
        dispatchFocusChange(true)
      }
    }

    const handleInputBlur = (e) => {
      if (e.target.tagName === 'TEXTAREA') {
        setTimeout(() => {
          const activeElement = document.activeElement
          const isInChat = chatContainerRef.current?.contains(activeElement)
          if (!isInChat || activeElement.tagName !== 'TEXTAREA') {
            dispatchFocusChange(false)
          }
        }, 100)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('focusin', handleInputFocus)
    document.addEventListener('focusout', handleInputBlur)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('focusin', handleInputFocus)
      document.removeEventListener('focusout', handleInputBlur)
    }
  }, [])

  const renderChatContent = () => {
    if (isConnecting) {
      return (
        <div className="flex h-full items-center justify-center text-sm text-[#8686AC]">
          Connecting to chat...
        </div>
      )
    }

    if (!chatClient || !channel) {
      return (
        <div className="h-full px-5 py-6 text-center text-sm text-zinc-300">
          <p className="mb-1 font-semibold text-white">Connection Failed</p>
          <p className="text-xs text-zinc-400">
            Could not connect to the chat service. Please try refreshing the page.
          </p>
        </div>
      )
    }

    return (
      <Chat client={chatClient} theme="str-chat__theme-dark">
        <Channel channel={channel}>
          <Window>
            <MessageList />
            <MessageInput focus={chatFocused} />
          </Window>
        </Channel>
      </Chat>
    )
  }

  return (
    <div
      ref={chatContainerRef}
      className="flex h-full flex-col bg-gradient-to-b from-[#14141a] via-[#0d0d14] to-black text-[#e6e7ea]"
    >
      {/* Header – HomePage-like UI */}
      <div className="flex h-12 items-center justify-between border-b border-zinc-800/80 bg-zinc-950/70 px-4 shadow-md">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-br from-[#9b99fe] to-[#2bc8b7] shadow-sm">
            <svg
              className="h-4 w-4 text-black"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M5.88657 21C5.57547 21 5.3399 20.7189 5.39427 20.4126L6.00001 17H2.59511C2.28449 17 2.04905 16.7198 2.10259 16.4138L2.27759 15.4138C2.31946 15.1746 2.52722 15 2.77011 15H6.35001L7.41001 9H4.00511C3.69449 9 3.45905 8.71977 3.51259 8.41381L3.68759 7.41381C3.72946 7.17456 3.93722 7 4.18011 7H7.76001L8.39677 3.41262C8.43914 3.17391 8.64664 3 8.88907 3H9.87344C10.1845 3 10.4201 3.28107 10.3657 3.58738L9.76001 7H15.76L16.3968 3.41262C16.4391 3.17391 16.6466 3 16.8891 3H17.8734C18.1845 3 18.4201 3.28107 18.3657 3.58738L17.76 7H21.1649C21.4755 7 21.711 7.28023 21.6574 7.58619L21.4824 8.58619C21.4406 8.82544 21.2328 9 20.9899 9H17.41L16.35 15H19.7549C20.0655 15 20.301 15.2802 20.2474 15.5862L20.0724 16.5862C20.0306 16.8254 19.8228 17 19.5799 17H16L15.3632 20.5874C15.3209 20.8261 15.1134 21 14.8709 21H13.8866C13.5755 21 13.3399 20.7189 13.3943 20.4126L14 17H8.00001L7.36325 20.5874C7.32088 20.8261 7.11337 21 6.87094 21H5.88657ZM9.41045 9L8.35045 15H14.3504L15.4104 9H9.41045Z" />
            </svg>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-xs font-semibold tracking-wide text-zinc-100">
              # world-chat
            </span>
            <span className="text-[10px] text-zinc-500">
              Global office channel
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            <span className="text-[11px] font-medium text-zinc-300">
              {onlineCount} online
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-800/70 hover:text-zinc-50"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="inline-block"
            >
              <path d="M18.4 4L12 10.4L5.6 4L4 5.6L10.4 12L4 18.4L5.6 20L12 13.6L18.4 20L20 18.4L13.6 12L20 5.6L18.4 4Z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Chat body */}
      <div className="flex flex-1 overflow-hidden">
        {renderChatContent()}
      </div>
    </div>
  )
}
