import { useEffect, useState, useRef } from "react";
import { Chat, Channel, Window, MessageList, MessageInput } from "stream-chat-react";
import "stream-chat-react/dist/css/v2/index.css";
import { useChat } from "../context/ChatContext";

export default function HUD() {
  const { chatClient, channel, isConnecting } = useChat();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const chatContainerRef = useRef(null);

  const [onlineCount, setOnlineCount] = useState(0);
  const [chatFocused, setChatFocused] = useState(false);
  const chatFocusedRef = useRef(chatFocused);
  
  useEffect(() => { 
    chatFocusedRef.current = chatFocused; 
  }, [chatFocused]);
  
  // Online count tracking
  useEffect(() => {
    if (!channel) return;
    const updateCount = () => {
      const members = Object.values(channel.state.members || {});
      const online = members.filter((m) => m.user?.online);
      setOnlineCount(online.length);
    };
    updateCount();
    channel.on("presence.diff", updateCount);
    return () => channel.off("presence.diff", updateCount);
  }, [channel]);
  
  // Chat focus management
  useEffect(() => {
    if (!isChatOpen) return;

    const dispatchFocusChange = (isFocused) => {
      if (chatFocusedRef.current === isFocused) return;
      setChatFocused(isFocused);
      window.dispatchEvent(
        new CustomEvent("chat-focus-change", { detail: { focused: isFocused } })
      );
    };
    
    const handleClickOutside = (event) => {
      if (chatContainerRef.current && !chatContainerRef.current.contains(event.target)) {
        if (chatFocusedRef.current) {
          dispatchFocusChange(false);
          const chatInput = chatContainerRef.current.querySelector("textarea");
          if (chatInput) chatInput.blur();
        }
      }
    };
    
    const handleInputFocus = (e) => {
      if (e.target.tagName === 'TEXTAREA') {
        dispatchFocusChange(true);
      }
    };
    
    const handleInputBlur = (e) => {
      if (e.target.tagName === 'TEXTAREA') {
        setTimeout(() => {
          const activeElement = document.activeElement;
          const isInChat = chatContainerRef.current?.contains(activeElement);
          if (!isInChat || activeElement.tagName !== 'TEXTAREA') {
            dispatchFocusChange(false);
          }
        }, 100);
      }
    };
    
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("focusin", handleInputFocus);
    document.addEventListener("focusout", handleInputBlur);
    
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("focusin", handleInputFocus);
      document.removeEventListener("focusout", handleInputBlur);
    };
  }, [isChatOpen]);
  
  const toggleChat = (e) => {
    e.stopPropagation();
    const willBeOpen = !isChatOpen;
    setIsChatOpen(willBeOpen);
    if (!willBeOpen) {
      setChatFocused(false);
      window.dispatchEvent(new CustomEvent("chat-focus-change", { detail: { focused: false } }));
    }
  };

  if (!isChatOpen) {
    return (
      <button className="chat-icon-button" onClick={toggleChat} title="Open Chat">
        {isConnecting ? (
          <div className="w-6 h-6 border-2 border-[#8686AC] border-t-transparent rounded-full animate-spin"></div>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )}
      </button>
    );
  }

  return (
    <div ref={chatContainerRef} className="chat-window-discord">
      {/* Header - Blue Eclipse Theme */}
      <div style={{
        height: '48px',
        backgroundColor: '#0F0E47',
        borderBottom: '1px solid #505081',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        flexShrink: 0,
        boxShadow: '0 2px 4px rgba(15, 14, 71, 0.5)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg style={{ width: '20px', height: '20px', color: '#8686AC' }} fill="currentColor" viewBox="0 0 24 24">
            <path d="M5.88657 21C5.57547 21 5.3399 20.7189 5.39427 20.4126L6.00001 17H2.59511C2.28449 17 2.04905 16.7198 2.10259 16.4138L2.27759 15.4138C2.31946 15.1746 2.52722 15 2.77011 15H6.35001L7.41001 9H4.00511C3.69449 9 3.45905 8.71977 3.51259 8.41381L3.68759 7.41381C3.72946 7.17456 3.93722 7 4.18011 7H7.76001L8.39677 3.41262C8.43914 3.17391 8.64664 3 8.88907 3H9.87344C10.1845 3 10.4201 3.28107 10.3657 3.58738L9.76001 7H15.76L16.3968 3.41262C16.4391 3.17391 16.6466 3 16.8891 3H17.8734C18.1845 3 18.4201 3.28107 18.3657 3.58738L17.76 7H21.1649C21.4755 7 21.711 7.28023 21.6574 7.58619L21.4824 8.58619C21.4406 8.82544 21.2328 9 20.9899 9H17.41L16.35 15H19.7549C20.0655 15 20.301 15.2802 20.2474 15.5862L20.0724 16.5862C20.0306 16.8254 19.8228 17 19.5799 17H16L15.3632 20.5874C15.3209 20.8261 15.1134 21 14.8709 21H13.8866C13.5755 21 13.3399 20.7189 13.3943 20.4126L14 17H8.00001L7.36325 20.5874C7.32088 20.8261 7.11337 21 6.87094 21H5.88657ZM9.41045 9L8.35045 15H14.3504L15.4104 9H9.41045Z"/>
          </svg>
          <h3 style={{ color: '#ffffff', fontSize: '16px', fontWeight: '600', margin: 0 }}>
            world-chat
          </h3>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#8686AC' }} />
            <span style={{ color: '#8686AC', fontSize: '13px', fontWeight: '500' }}>
              {onlineCount} online
            </span>
          </div>
          
          <button
            onClick={toggleChat}
            style={{
              width: '32px', height: '32px', display: 'flex', alignItems: 'center',
              justifyContent: 'center', background: 'transparent', border: 'none',
              cursor: 'pointer', color: '#8686AC', borderRadius: '4px', transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#ffffff';
              e.currentTarget.style.backgroundColor = '#505081';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#8686AC';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.4 4L12 10.4L5.6 4L4 5.6L10.4 12L4 18.4L5.6 20L12 13.6L18.4 20L20 18.4L13.6 12L20 5.6L18.4 4Z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Chat Body */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {chatClient && channel && (
          <Chat client={chatClient}>
            <Channel channel={channel}>
              <Window>
                <MessageList />
                <MessageInput focus={chatFocused} />
              </Window>
            </Channel>
          </Chat>
        )}
      </div>
    </div>
  );
}