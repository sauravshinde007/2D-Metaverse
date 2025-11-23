// client/src/components/PrivateChatManager.jsx

import React, { useState, useEffect, useRef } from 'react'
import { useChat } from '../context/ChatContext'
import { useAuth } from '../context/AuthContext'
import {
  Chat,
  Channel,
  Window,
  MessageList,
  MessageInput,
  ChannelList,
} from 'stream-chat-react'

import 'stream-chat-react/dist/css/v2/index.css'
import '../styles/PrivateChatManager.css'

export default function PrivateChatManager({ onClose }) {
  const { chatClient } = useChat()
  const { token } = useAuth()
  const [showUserList, setShowUserList] = useState(false)
  const [userList, setUserList] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [activePrivateChannel, setActivePrivateChannel] = useState(null)

  const serverUrl = import.meta.env.VITE_SOCKET_SERVER_URL

  // Focus handling
  const chatContainerRef = useRef(null)
  const [chatFocused, setChatFocused] = useState(false)
  const chatFocusedRef = useRef(chatFocused)

  useEffect(() => {
    chatFocusedRef.current = chatFocused
  }, [chatFocused])

  // Focus-handling logic (same as before)
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
        // Ignore clicks on sidebar private-chat icon
        const sidebarButton = document.querySelector(
          '.sidebar-icon-button[title="Private Chats"]'
        )
        if (sidebarButton && sidebarButton.contains(event.target)) {
          return
        }

        if (chatFocusedRef.current) {
          dispatchFocusChange(false)
          const chatInput =
            chatContainerRef.current.querySelector('textarea')
          if (chatInput) chatInput.blur()
        }
      }
    }

    const handleInputFocus = (e) => {
      if (
        e.target.tagName === 'TEXTAREA' &&
        chatContainerRef.current?.contains(e.target)
      ) {
        dispatchFocusChange(true)
      }
    }

    const handleInputBlur = (e) => {
      if (
        e.target.tagName === 'TEXTAREA' &&
        chatContainerRef.current?.contains(e.target)
      ) {
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
      dispatchFocusChange(false)
    }
  }, [])

  // --- SAME AS OLD: fetchUsers, toggleUserList, startPrivateChat ---

  const fetchUsers = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${serverUrl}/api/users`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(
          data.message || `Failed to fetch users (status: ${response.status})`
        )
      }
      setUserList(data.filter((user) => user.username !== chatClient.userID))
    } catch (err) {
      if (err.name === 'SyntaxError') {
        setError('Received non-JSON response. Is proxy running?')
      } else {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  const toggleUserList = () => {
    const newState = !showUserList
    setShowUserList(newState)
    if (newState && userList.length === 0) {
      fetchUsers()
    }
  }

  const startPrivateChat = async (targetUser) => {
    try {
      const channel = chatClient.channel('messaging', {
        members: [chatClient.userID, targetUser.username],
      })
      await channel.watch()
      setActivePrivateChannel(channel)
      setShowUserList(false)
    } catch (err) {
      console.error('Error starting private chat:', err)
    }
  }

  if (!chatClient) {
    return null
  }

  return (
    <Chat client={chatClient} theme="str-chat__theme-dark">
      {/* MAIN WRAPPER – HomePage-like UI, logic unchanged */}
      <div
        ref={chatContainerRef}
        className="private-chat-panel"
      >
        {/* LEFT SIDEBAR */}
        <div
          className="
            private-chat-sidebar
            flex h-full w-64 flex-col
            border-r border-zinc-800/80 bg-zinc-950/80
          "
        >
          {/* HEADER */}
          <div
            className="
              private-chat-header
              flex h-12 items-center justify-between
              border-b border-zinc-800/80 bg-zinc-950 px-3
            "
          >
            <div className="flex items-center gap-2">
              {showUserList && (
                <button
                  onClick={() => setShowUserList(false)}
                  className="
                    back-button
                    flex h-7 w-7 items-center justify-center
                    rounded-lg text-zinc-400
                    hover:bg-zinc-800/70 hover:text-zinc-50
                  "
                  title="Back"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    fill="currentColor"
                    viewBox="0 0 16 16"
                  >
                    <path
                      fillRule="evenodd"
                      d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8z"
                    />
                  </svg>
                </button>
              )}

              <h4 className="m-0 text-xs font-semibold tracking-wide text-zinc-100">
                {showUserList ? 'Start a Chat' : 'Private Messages'}
              </h4>
            </div>

            <button
              onClick={onClose}
              title="Close Panel"
              className="
                flex h-7 w-7 items-center justify-center
                rounded-lg text-zinc-400
                hover:bg-zinc-800/70 hover:text-zinc-50
              "
            >
              <span className="text-lg leading-none">&times;</span>
            </button>
          </div>

          {/* BODY: user list OR channel list (unchanged logic) */}
          {showUserList ? (
            <div
              className="
                user-list-container
                flex h-full flex-col px-2 py-2
              "
            >
              {loading && (
                <div className="list-info-text px-2 py-1 text-xs text-zinc-400">
                  Loading users...
                </div>
              )}
              {error && (
                <div className="error-text px-2 py-1 text-xs text-red-400">
                  Error: {error}
                </div>
              )}
              <ul className="user-list-body mt-1 flex-1 overflow-y-auto text-sm">
                {userList.length > 0 ? (
                  userList.map((user) => (
                    <li
                      key={user.username}
                      onClick={() => startPrivateChat(user)}
                      className="
                        mb-1 cursor-pointer rounded-lg
                        px-2 py-1.5 text-zinc-200
                        hover:bg-zinc-800/80
                      "
                    >
                      {user.username}
                    </li>
                  ))
                ) : (
                  !loading &&
                  !error && (
                    <li className="list-info-text px-2 py-2 text-xs text-zinc-500">
                      No users found
                    </li>
                  )
                )}
              </ul>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto">
                <ChannelList
                  filters={{
                    type: 'messaging',
                    members: { $in: [chatClient.userID] },
                    member_count: 2,
                  }}
                  sort={{ last_message_at: -1 }}
                  onSelect={(channel) => setActivePrivateChannel(channel)}
                />
              </div>
              <div className="px-2 py-2">
                <button
                  onClick={toggleUserList}
                  className="
                    new-chat-button
                    flex w-full items-center justify-center
                    rounded-lg bg-gradient-to-r
                    from-[#9b99fe] to-[#2bc8b7]
                    px-3 py-1.5 text-xs font-semibold text-black
                    shadow hover:opacity-95
                  "
                >
                  + New Private Chat
                </button>
              </div>
            </>
          )}
        </div>

        {/* RIGHT: active chat window (UNCHANGED LOGIC) */}
        <div
          className="
            private-chat-window
            flex flex-1 flex-col bg-zinc-950/60
          "
        >
          <Channel channel={activePrivateChannel}>
            <Window>
              <MessageList />
              <MessageInput focus={chatFocused} />
            </Window>
          </Channel>
        </div>
      </div>
    </Chat>
  )
}
