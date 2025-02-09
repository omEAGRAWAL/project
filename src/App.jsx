import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import Peer from 'simple-peer';
import { BsCameraVideo, BsCameraVideoOff, BsMic, BsMicMute } from 'react-icons/bs';

// const socket = io(' ');
// const socket = io("https://webrtc_app.vercel.app", {
//   path: "/api/socket.io",
// });
const socket = io({
  path: "/api/socket.io",
});
function App() {
  const [username, setUsername] = useState('');
  const [joined, setJoined] = useState(false);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [users, setUsers] = useState([]);
  const [stream, setStream] = useState(null);
  const [receivingCall, setReceivingCall] = useState(false);
  const [caller, setCaller] = useState('');
  const [callerSignal, setCallerSignal] = useState(null);
  const [callAccepted, setCallAccepted] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const myVideo = useRef();
  const userVideo = useRef();
  const connectionRef = useRef();

  useEffect(() => {
    // Get media stream
    const getMedia = async () => {
      try {
        const currentStream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: true 
        });
        setStream(currentStream);
        if (myVideo.current) {
          myVideo.current.srcObject = currentStream;
        }
      } catch (err) {
        console.error("Error accessing media devices:", err);
      }
    };

    getMedia();

    // Socket event listeners
    socket.on('message', (message) => {
      setMessages((prev) => [...prev, message]);
    });

    socket.on('userList', (userList) => {
      setUsers(userList);
    });

    socket.on('callUser', (data) => {
      setReceivingCall(true);
      setCaller(data.from);
      setCallerSignal(data.signal);
    });

    return () => {
      // Cleanup
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (connectionRef.current) {
        connectionRef.current.destroy();
      }
      socket.off('message');
      socket.off('userList');
      socket.off('callUser');
      socket.off('callAccepted');
    };
  }, []);

  const joinChat = () => {
    if (username.trim()) {
      socket.emit('join', username);
      setJoined(true);
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (messageInput.trim()) {
      socket.emit('message', { text: messageInput });
      setMessageInput('');
    }
  };

  const callUser = (userId) => {
    try {
      const peer = new Peer({
        initiator: true,
        trickle: false,
        stream: stream,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
          ]
        }
      });

      peer.on('signal', (data) => {
        socket.emit('callUser', {
          userToCall: userId,
          signalData: data,
          from: socket.id
        });
      });

      peer.on('stream', (remoteStream) => {
        if (userVideo.current) {
          userVideo.current.srcObject = remoteStream;
        }
      });

      peer.on('error', (err) => {
        console.error("Peer error:", err);
        peer.destroy();
      });

      socket.on('callAccepted', (signal) => {
        setCallAccepted(true);
        peer.signal(signal);
      });

      connectionRef.current = peer;
    } catch (err) {
      console.error("Error creating peer:", err);
    }
  };

  const answerCall = () => {
    try {
      setCallAccepted(true);
      const peer = new Peer({
        initiator: false,
        trickle: false,
        stream: stream,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
          ]
        }
      });

      peer.on('signal', (data) => {
        socket.emit('answerCall', { signal: data, to: caller });
      });

      peer.on('stream', (remoteStream) => {
        if (userVideo.current) {
          userVideo.current.srcObject = remoteStream;
        }
      });

      peer.on('error', (err) => {
        console.error("Peer error:", err);
        peer.destroy();
      });

      peer.signal(callerSignal);
      connectionRef.current = peer;
    } catch (err) {
      console.error("Error answering call:", err);
    }
  };

  const toggleMute = () => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  if (!joined) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="p-8 bg-white rounded-lg shadow-md">
          <h1 className="text-2xl font-bold mb-4">Join Chat</h1>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your username"
            className="w-full p-2 border rounded mb-4"
          />
          <button
            onClick={joinChat}
            className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
          >
            Join
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Chat Section */}
      <div className="w-1/3 flex flex-col bg-white">
        <div className="p-4 border-b">
          <h2 className="text-xl font-bold">Chat</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {messages.map((message, index) => (
            <div key={index} className="mb-4">
              <p className="font-bold">{message.user}</p>
              <p className="text-gray-700">{message.text}</p>
              <p className="text-xs text-gray-500">
                {new Date(message.timestamp).toLocaleTimeString()}
              </p>
            </div>
          ))}
        </div>
        <form onSubmit={sendMessage} className="p-4 border-t">
          <input
            type="text"
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            placeholder="Type a message..."
            className="w-full p-2 border rounded"
          />
        </form>
      </div>

      {/* Video Section */}
      <div className="w-2/3 flex flex-col bg-gray-800">
        <div className="flex-1 p-4">
          <div className="grid grid-cols-2 gap-4 h-full">
            <div className="relative">
              <video
                playsInline
                muted
                ref={myVideo}
                autoPlay
                className="w-full h-full object-cover rounded-lg"
              />
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-4">
                <button
                  onClick={toggleMute}
                  className="p-2 rounded-full bg-gray-700 text-white hover:bg-gray-600"
                >
                  {isMuted ? <BsMicMute /> : <BsMic />}
                </button>
                <button
                  onClick={toggleVideo}
                  className="p-2 rounded-full bg-gray-700 text-white hover:bg-gray-600"
                >
                  {isVideoOff ? <BsCameraVideoOff /> : <BsCameraVideo />}
                </button>
              </div>
            </div>
            {callAccepted && (
              <video
                playsInline
                ref={userVideo}
                autoPlay
                className="w-full h-full object-cover rounded-lg"
              />
            )}
          </div>
        </div>

        {/* Users List */}
        <div className="p-4 bg-gray-700">
          <h3 className="text-white mb-2">Online Users</h3>
          <div className="flex space-x-2">
            {users.map((user, index) => (
              <button
                key={index}
                onClick={() => callUser(user.id)}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Call {user.username}
              </button>
            ))}
          </div>
        </div>

        {receivingCall && !callAccepted && (
          <div className="absolute top-4 right-4 p-4 bg-white rounded-lg shadow-lg">
            <p className="mb-2">{caller} is calling...</p>
            <button
              onClick={answerCall}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              Answer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;