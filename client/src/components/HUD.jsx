import { useEffect, useState } from "react";
import { StreamChat } from "stream-chat";
import {
  Chat,
  Channel,
  Window,
  MessageList,
  MessageInput,
  Thread,
} from "stream-chat-react";
import "stream-chat-react/dist/css/v2/index.css";

const apiKey = import.meta.env.VITE_STREAM_API_KEY;

export default function HUD() {
  const [chatClient, setChatClient] = useState(null);
  const [channel, setChannel] = useState(null);
  const [onlineCount, setOnlineCount] = useState(0);

  useEffect(() => {
    const client = StreamChat.getInstance(apiKey);

    async function init() {
      // ✅ Prevent reconnect if already connected
      if (client.userID) {
        console.log("StreamChat: already connected as", client.userID);
        setChatClient(client);
        return;
      }

      const userId = "user_" + Math.floor(Math.random() * 1000);
      const res = await fetch(`http://localhost:3001/get-token/${userId}`);
      const data = await res.json();

      await client.connectUser({ id: userId, name: userId }, data.token);

      const channel = client.channel("messaging", "metaverse-room", {
        name: "Metaverse Lobby",
        members: [userId],
      });

      await channel.watch({ presence: true });
      updateOnlineCount(channel);

      setChatClient(client);
      setChannel(channel);
    }

    init();

    return () => {
      client.disconnectUser();
    };
  }, []);

  const updateOnlineCount = (channel) => {
    const members = Object.values(channel.state.members || {});
    const online = members.filter((m) => m.user?.online);
    setOnlineCount(online.length);
  };

  // ✅ Fix: Disable Phaser keyboard input while typing in chat
  useEffect(() => {
    const toggleKeyboard = (enabled) => {
      if (window.game?.input?.keyboard) {
        window.game.input.keyboard.enabled = enabled;
      }
    };

    const handleFocus = () => toggleKeyboard(false);
    const handleBlur = () => toggleKeyboard(true);

    const chatInputs = document.querySelectorAll("input, textarea");

    chatInputs.forEach((input) => {
      input.addEventListener("focus", handleFocus);
      input.addEventListener("blur", handleBlur);
    });

    return () => {
      chatInputs.forEach((input) => {
        input.removeEventListener("focus", handleFocus);
        input.removeEventListener("blur", handleBlur);
      });
    };
  }, [channel]);

  if (!chatClient || !channel) return null;

  return (
    <div
      className="absolute bottom-4 right-4 w-96 h-[500px] rounded-xl shadow-lg border bg-white/95 overflow-hidden flex flex-col"
      style={{ zIndex: 50 }} // ✅ keeps it above Phaser canvas
    >
      <Chat client={chatClient} theme="str-chat__theme-light">
        <Channel channel={channel}>
          <Window>
            {/* Header */}
            <div className="p-3 border-b bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-bold flex justify-between items-center">
              <span>💬 Metaverse Lobby</span>
              <span className="text-sm">{onlineCount} online</span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto bg-gray-50">
              <MessageList />
            </div>

            {/* Input */}
            <div className="border-t bg-white">
              <MessageInput focus />
            </div>
          </Window>
          <Thread />
        </Channel>
      </Chat>
    </div>
  );
}
