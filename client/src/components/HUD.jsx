import { useEffect, useState } from "react";
import { StreamChat } from "stream-chat";
import {
  Chat,
  Channel,
  Window,
  ChannelHeader,
  MessageList,
  MessageInput,
  Thread,
  ChannelList,
} from "stream-chat-react";
import "stream-chat-react/dist/css/v2/index.css";

const apiKey = import.meta.env.VITE_STREAM_API_KEY; // from dashboard

export default function HUD() {
  const [chatClient, setChatClient] = useState(null);
  const [channel, setChannel] = useState(null);

  useEffect(() => {
  const client = StreamChat.getInstance(apiKey);

  async function init() {
    if (client.userID) return; // ✅ already connected, skip

    const userId = "user_" + Math.floor(Math.random() * 1000);
    const res = await fetch(`http://localhost:3001/get-token/${userId}`);
    const data = await res.json();

    await client.connectUser({ id: userId, name: userId }, data.token);

    const channel = client.channel("messaging", "metaverse-room", {
      name: "Metaverse Lobby",
      members: [userId],
    });
    await channel.watch();

    setChatClient(client);
    setChannel(channel);
  }

  init();

  return () => {
    client.disconnectUser(); // ✅ cleanup
  };
}, []);

  if (!chatClient || !channel) return null;

  return (
    <div className="absolute right-0 top-0 w-80 h-full bg-white shadow-lg z-10">
      <Chat client={chatClient} theme="str-chat__theme-light">
        <Channel channel={channel}>
          <Window>
            <ChannelHeader />
            <MessageList />
            <MessageInput />
          </Window>
          <Thread />
        </Channel>
      </Chat>
    </div>
  );
}
